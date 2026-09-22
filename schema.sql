-- Mr Karim — D1 schema
-- Applied with: wrangler d1 execute mr-karim --file=schema.sql

-- Every inbound item, from any source, normalised to one shape.
CREATE TABLE IF NOT EXISTS messages (
  id            TEXT PRIMARY KEY,
  source        TEXT NOT NULL CHECK (source IN ('gmail', 'wa_business', 'wa_personal')),
  account       TEXT NOT NULL,           -- which inbox or number it arrived on
  external_id   TEXT NOT NULL,           -- Gmail message id / WhatsApp wamid
  thread_id     TEXT,
  sender        TEXT NOT NULL,           -- email address or phone number
  sender_name   TEXT,
  subject       TEXT,                    -- null for WhatsApp
  body          TEXT NOT NULL,
  has_attachments INTEGER NOT NULL DEFAULT 0,
  received_at   INTEGER NOT NULL,        -- unix seconds
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_received ON messages (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender   ON messages (sender);

-- Haiku's classification of each message. One row per message.
CREATE TABLE IF NOT EXISTS triage (
  message_id   TEXT PRIMARY KEY REFERENCES messages (id) ON DELETE CASCADE,
  category     TEXT NOT NULL,            -- bank | government | supplier | customer | personal | noise
  urgency      TEXT NOT NULL CHECK (urgency IN ('now', 'today', 'this_week', 'whenever', 'none')),
  needs_reply  INTEGER NOT NULL DEFAULT 0,
  is_bill      INTEGER NOT NULL DEFAULT 0,
  summary      TEXT,                     -- one line, for the queue view
  reasoning    TEXT,
  model        TEXT NOT NULL,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_triage_urgency ON triage (urgency, needs_reply);

-- Opus's proposed reply. Never sent without an explicit approval action.
CREATE TABLE IF NOT EXISTS drafts (
  id           TEXT PRIMARY KEY,
  message_id   TEXT NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  body         TEXT NOT NULL,            -- as generated
  final_body   TEXT,                     -- as edited by the operator, if changed
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'sent', 'dismissed')),
  model        TEXT NOT NULL,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  sent_at      INTEGER
);

CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts (status, created_at DESC);

-- Extracted payment obligations, with reminders driven off due_date.
CREATE TABLE IF NOT EXISTS bills (
  id           TEXT PRIMARY KEY,
  message_id   TEXT REFERENCES messages (id) ON DELETE SET NULL,
  payee        TEXT NOT NULL,
  amount       REAL,
  currency     TEXT DEFAULT 'SGD',
  due_date     TEXT,                     -- ISO date
  reference    TEXT,                     -- invoice or account number
  status       TEXT NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open', 'paid', 'dismissed')),
  reminded_at  INTEGER,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_bills_due ON bills (status, due_date);

-- Operator-editable rules, versioned so a bad edit can be rolled back.
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Cursors for incremental sync: Gmail historyId, WhatsApp last-seen, etc.
CREATE TABLE IF NOT EXISTS sync_state (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
