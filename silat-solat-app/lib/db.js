import "server-only";
import pg from "pg";
import { SEED_CLASSES } from "./branches.js";
import { SEED_VIDEOS } from "./library.js";
import { SEED_CAMPAIGNS } from "./campaigns.js";

// The app's own Postgres (Railway). Tables are created, and the starting
// timetable, videos and campaigns seeded, the first time the server needs the
// database. DATABASE_URL is optional: without it the public pages still work
// (timetable from lib/branches.js) and sign-in is hidden.

let pool = null;
let ready = null;

export function dbConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

const SCHEMA = `
create table if not exists app_users (
  id          bigserial primary key,
  google_sub  text unique,
  email       text not null,
  name        text not null default '',
  picture     text,
  call_me     text,
  role        text not null default 'member',  -- member | instructor | admin
  phone       text,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);
create index if not exists app_users_email on app_users (lower(email));

-- Kept for the shared Quran reader's "continue reading" bookmark.
create table if not exists app_progress (
  user_id     bigint primary key references app_users(id) on delete cascade,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

create table if not exists classes (
  id          bigserial primary key,
  branch      text not null,
  stream      text not null,               -- adults | sisters | kids
  weekday     int not null,                -- 0 Sunday .. 6 Saturday
  starts      text not null,               -- "20:00"
  ends        text not null,
  confirmed   boolean not null default false,
  active      boolean not null default true,
  note        text
);

-- Which instructor teaches which branch and stream. Sisters' rosters are only
-- ever assigned to female instructors (admin's rule), so nobody else sees them.
create table if not exists instructor_assignments (
  user_id     bigint not null references app_users(id) on delete cascade,
  branch      text not null,
  stream      text not null,
  primary key (user_id, branch, stream)
);

-- A training profile. Adults hold their own; a parent holds their children's.
-- Under-18s never have a login of their own.
create table if not exists members (
  id            bigserial primary key,
  account_id    bigint not null references app_users(id) on delete cascade,
  full_name     text not null,
  display_name  text not null,
  birth_year    int,
  gender        text,                       -- male | female
  stream        text not null,
  branch        text not null,
  level         int not null default -1,     -- -1 = no sash yet (lib/sashes.js)
  stripes       int not null default 0,
  level_since   date not null default current_date,
  medical_notes text,
  media_consent boolean not null default false,
  status        text not null default 'active',   -- active | paused
  created_at    timestamptz not null default now()
);
create index if not exists members_account on members (account_id);

create table if not exists attendance (
  member_id   bigint not null references members(id) on delete cascade,
  class_id    bigint not null references classes(id) on delete cascade,
  day         date not null,
  method      text not null default 'qr',   -- qr | roster
  at          timestamptz not null default now(),
  primary key (member_id, class_id, day)
);

create table if not exists signoffs (
  member_id   bigint not null references members(id) on delete cascade,
  item        text not null,
  by_user     bigint references app_users(id) on delete set null,
  at          timestamptz not null default now(),
  primary key (member_id, item)
);

create table if not exists member_notes (
  id          bigserial primary key,
  member_id   bigint not null references members(id) on delete cascade,
  by_user     bigint references app_users(id) on delete set null,
  body        text not null,
  at          timestamptz not null default now()
);

create table if not exists gradings (
  id          bigserial primary key,
  branch      text,                          -- null = all branches
  day         date not null,
  starts      text not null default '09:30',
  note        text,
  created_by  bigint references app_users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists grading_results (
  id          bigserial primary key,
  grading_id  bigint not null references gradings(id) on delete cascade,
  member_id   bigint not null references members(id) on delete cascade,
  from_level  int not null,
  to_level    int not null,
  result      text not null,                 -- pass | conditional | retry
  approved    boolean not null default true, -- black sash waits for the Ustaz
  by_user     bigint references app_users(id) on delete set null,
  at          timestamptz not null default now(),
  unique (grading_id, member_id)
);

create table if not exists settings (
  key   text primary key,
  value text not null
);

create table if not exists announcements (
  id          bigserial primary key,
  branch      text,                          -- null = everyone
  stream      text,                          -- null = every stream
  title       text not null,
  body        text not null,
  kind        text not null default 'news',  -- news | grading | campaign
  by_user     bigint references app_users(id) on delete set null,
  at          timestamptz not null default now()
);

create table if not exists videos (
  id          bigserial primary key,
  youtube_id  text not null,
  title_ms    text not null,
  title_en    text not null,
  level       int,                           -- null = not tied to a sash
  topic       text not null,                 -- jurus | buah | tekpi | adab | fitness | tazkirah
  steps_ms    text,
  steps_en    text,
  adab_ms     text,
  adab_en     text,
  published   boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists questions (
  id          bigserial primary key,
  name        text,
  email       text,
  question    text not null,
  answer_ms   text,
  answer_en   text,
  question_en text,
  published   boolean not null default false,
  sort        int not null default 100,
  created_at  timestamptz not null default now()
);

create table if not exists trial_bookings (
  id          bigserial primary key,
  name        text not null,
  contact     text not null,
  class_id    bigint references classes(id) on delete set null,
  day         date not null,
  people      int not null default 1,
  note        text,
  created_at  timestamptz not null default now()
);

create table if not exists campaigns (
  id          bigserial primary key,
  slug        text not null unique,
  title_ms    text not null,
  title_en    text not null,
  body_ms     text not null,
  body_en     text not null,
  goal_cents  int,
  branch      text,
  status      text not null default 'active',  -- active | upcoming | closed
  volunteers  boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists volunteers (
  id          bigserial primary key,
  campaign_id bigint not null references campaigns(id) on delete cascade,
  name        text not null,
  contact     text not null,
  created_at  timestamptz not null default now()
);

-- Every payment, whatever it is for. All of it lands in the one Silat n Solat
-- bank account; "purpose" keeps campaign money reportable on its own.
create table if not exists payments (
  id            bigserial primary key,
  ref           text not null unique,          -- shown on PayNow, e.g. SS-7K2Q9
  user_id       bigint references app_users(id) on delete set null,
  purpose       text not null,                 -- support | book | campaign
  campaign_id   bigint references campaigns(id) on delete set null,
  amount_cents  int not null,
  monthly       boolean not null default false,
  method        text not null,                 -- paynow | card | cash
  status        text not null default 'pending', -- pending | paid | cancelled
  payer_name    text,
  payer_contact text,
  stripe_session      text,
  stripe_subscription text,
  details       jsonb,
  created_at    timestamptz not null default now(),
  paid_at       timestamptz
);
create index if not exists payments_status on payments (status, created_at desc);
`;

async function seed(client) {
  const { rows } = await client.query("select count(*)::int as n from classes");
  if (rows[0].n === 0) {
    for (const [branch, stream, weekday, starts, ends, confirmed] of SEED_CLASSES) {
      await client.query(
        "insert into classes (branch, stream, weekday, starts, ends, confirmed) values ($1,$2,$3,$4,$5,$6)",
        [branch, stream, weekday, starts, ends, confirmed]
      );
    }
  }
  const v = await client.query("select count(*)::int as n from videos");
  if (v.rows[0].n === 0) {
    for (const [i, x] of SEED_VIDEOS.entries()) {
      await client.query(
        `insert into videos (youtube_id, title_ms, title_en, level, topic, steps_ms, steps_en, adab_ms, adab_en, sort)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [x.youtube, x.ms, x.en, x.level ?? null, x.topic, x.stepsMs || null, x.stepsEn || null, x.adabMs || null, x.adabEn || null, i]
      );
    }
  }
  const c = await client.query("select count(*)::int as n from campaigns");
  if (c.rows[0].n === 0) {
    for (const x of SEED_CAMPAIGNS) {
      await client.query(
        `insert into campaigns (slug, title_ms, title_en, body_ms, body_en, goal_cents, branch, status, volunteers)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [x.slug, x.titleMs, x.titleEn, x.bodyMs, x.bodyEn, x.goalCents ?? null, x.branch ?? null, x.status, x.volunteers]
      );
    }
  }
  await client.query(
    "insert into settings (key, value) values ('grading_frequency', 'monthly') on conflict (key) do nothing"
  );
}

function getPool() {
  pool ??= new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    ssl: /sslmode=require/.test(process.env.DATABASE_URL) ? { rejectUnauthorized: false } : undefined,
  });
  return pool;
}

async function prepare() {
  const client = await getPool().connect();
  try {
    await client.query("select pg_advisory_lock(84210)");
    await client.query(SCHEMA);
    await seed(client);
  } finally {
    await client.query("select pg_advisory_unlock(84210)").catch(() => {});
    client.release();
  }
}

/** A query, with the tables created the first time the server needs them. */
export async function query(text, params = []) {
  if (!dbConfigured()) throw new Error("DATABASE_URL is not set");
  ready ??= prepare().catch((err) => {
    ready = null;
    throw err;
  });
  await ready;
  return getPool().query(text, params);
}

/** Run `fn(client)` inside one transaction; it is rolled back if `fn` throws. */
export async function transaction(fn) {
  await query("select 1");
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function getSetting(key, fallback = null) {
  if (!dbConfigured()) return fallback;
  const { rows } = await query("select value from settings where key = $1", [key]);
  return rows[0]?.value ?? fallback;
}

export async function setSetting(key, value) {
  await query(
    "insert into settings (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value",
    [key, String(value)]
  );
}
