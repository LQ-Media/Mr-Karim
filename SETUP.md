# Setup

Run in order. Steps 1–2 are done in a browser; the rest are terminal on the Mac
Studio. Design and rationale live in `ARCHITECTURE.md`.

## 0. Try it first — about 2 cents, no infrastructure

Before setting anything up, find out whether the agent's judgement matches
yours. This runs on the Mac alone: no Cloudflare, no database, no deployment.

Needs **Node 22.6 or newer** — check with `node --version`. If it's older,
`brew upgrade node` or install from nodejs.org. Anything below 22.6 fails with
`unknown option --experimental-strip-types`.

All the work lives on the `claude/tender-lovelace-bc6kxg` branch — `main` is
empty, so clone the branch explicitly. Run these **one line at a time**.

```sh
git clone -b claude/tender-lovelace-bc6kxg https://github.com/LQ-Media/Mr-Karim.git
cd Mr-Karim
npm install
```

Then create `.env` in the project directory. A heredoc keeps the key out of
your shell history, which `export` on the command line does not:

```sh
cat > .env <<'KEY'
ANTHROPIC_API_KEY=sk-ant-api03-...
KEY
chmod 600 .env
```

`.env` is gitignored and is loaded automatically. Then:

```sh
npm run test:triage
```

### If npm install fails with EACCES

The npm cache is owned by root, usually left behind by an earlier
`sudo npm install`:

```sh
sudo chown -R $(whoami) ~/.npm
```

It classifies the ten sample messages in `test/samples.jsonl` using the real
rules from `settings/rules.md`, prints what it decided and why, and reports the
exact cost of the run.

Then replace `test/samples.jsonl` with **your own real messages** and run it
again. If the classifications match your instincts, the design holds. If they
don't, edit `settings/rules.md` and re-run — that file is the fix, not the code.

Each run costs a fraction of a cent. Iterate freely.

## 1. Anthropic Console — console.anthropic.com

Sign in as `karim@littlequrankids.sg`.

- **Billing** → add a payment method → buy credits. **$5 is the minimum and is
  enough to evaluate.** Top up to $25 only once you've decided to proceed.
  The Claude Pro subscription does *not* cover API usage. Separate meter.
- **Limits** → set a monthly cap of **$75**. This is the circuit breaker if
  anything ever loops. Do not skip it.
- **API Keys** → Create Key → name it `mr-karim-agent` → copy it.

Put the key straight into a password manager. It goes into Cloudflare's secret
store in step 5 and should never be pasted into a chat, a file, or this repo.

## 2. Cloudflare — dash.cloudflare.com

Sign up with the same email. **The free tier is enough** — 100,000 requests a
day against your ~150, and waiting on the Claude API bills as I/O, not CPU, so
the free tier's CPU limit is not the constraint I first assumed. Upgrade to
Workers Paid only if you actually hit a limit.

**Do not add `littlequrankids.sg` as a site.** Cloudflare's free plan requires
delegating the whole domain, which would move the live Google Workspace MX
records away from Exabytes. v1 runs on a free `workers.dev` subdomain instead —
see `ARCHITECTURE.md` §7.

## 3. Install and authenticate

```sh
git clone https://github.com/LQ-Media/Mr-Karim.git
cd Mr-Karim
npm install
npx wrangler login          # opens a browser
```

## 4. Create the database

```sh
npm run db:create
```

Copy the `database_id` it prints into `wrangler.toml`, replacing
`PLACEHOLDER_REPLACE_AFTER_D1_CREATE`. Then apply the schema:

```sh
npm run db:migrate
```

## 5. Connect Gmail

At **console.cloud.google.com**, in any project:

1. **APIs & Services → Library** → enable the **Gmail API**.
2. **OAuth consent screen** → External → add yourself as a test user.
   It never needs Google verification while you are the only user.
3. **Credentials → Create OAuth client ID → Web application.**
   Authorised redirect URI: `http://localhost:8788/callback`
4. Add the client id and secret to `.env`:

```
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
```

Then authorise each inbox in turn. Run it once signed in as
`karim@littlequrankids.sg`, then again signed in as the personal account:

```sh
npm run auth:google
```

It prints a refresh token each time. That token grants read access to the
mailbox — treat it like a password.

## 6. Set secrets

Each command prompts for the value; nothing is echoed or written to disk.

```sh
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GMAIL_REFRESH_TOKEN_WORK
npx wrangler secret put GMAIL_REFRESH_TOKEN_PERSONAL
npx wrangler secret put WHATSAPP_VERIFY_TOKEN    # invent one, keep it handy
npx wrangler secret put BRIDGE_SHARED_SECRET     # openssl rand -hex 32
```

`WHATSAPP_ACCESS_TOKEN` comes later, with the Cloud API.

## 7. Deploy and verify

```sh
npm run deploy
```

Note the `https://mr-karim.<subdomain>.workers.dev` URL, then:

```sh
curl https://mr-karim.<subdomain>.workers.dev/health
```

Expect `{"ok":true,"db":"connected","messages":0,"triaged":0,"open_bills":0}`.
If `db` says `unreachable`, the `database_id` in `wrangler.toml` is wrong or
the migration did not run.

## 8. Trigger a poll without waiting for cron

```sh
curl -X POST https://mr-karim.<subdomain>.workers.dev/admin/poll \
  -H "x-bridge-secret: <BRIDGE_SHARED_SECRET>"
```

Returns counts of what it fetched, stored and triaged, plus any errors. Then
`/health` again to see the totals climb.

---

## What works after this

Every five minutes the Worker polls both inboxes for mail from the last
fifteen minutes, stores anything new, and classifies whatever is unclassified.
Re-polling the same window is harmless — duplicates are dropped on insert.

Classification uses `settings/rules.md`, bundled as a default. Once a `rules`
row exists in the `settings` table it takes precedence, so edits need no
redeploy.

## Still to come

- Drafting replies with Opus, and the approve/edit/send path
- Dashboard, behind Cloudflare Access
- Meta Cloud API connection via coexistence
- Mac Studio bridge for personal WhatsApp, read-only
- Bill extraction from PDFs, due-date reminders
