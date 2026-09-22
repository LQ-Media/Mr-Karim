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

## 5. Set secrets

Each command prompts for the value; nothing is echoed or written to disk.

```sh
npx wrangler secret put ANTHROPIC_API_KEY        # from step 1
npx wrangler secret put WHATSAPP_VERIFY_TOKEN    # invent one, keep it handy
npx wrangler secret put BRIDGE_SHARED_SECRET     # openssl rand -hex 32
```

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `WHATSAPP_ACCESS_TOKEN` come
later, when Gmail and the Cloud API are wired up.

## 6. Deploy and verify

```sh
npm run deploy
```

Note the `https://mr-karim.<subdomain>.workers.dev` URL it prints, then:

```sh
curl https://mr-karim.<subdomain>.workers.dev/health
```

Expect `{"ok":true,"db":"connected"}`. If `db` says `unreachable`, the
`database_id` in `wrangler.toml` is wrong or the migration didn't run.

---

## What works after this

The Worker is deployed, the database exists, and the Meta webhook verification
handshake will succeed. Ingest, triage, drafting and the dashboard are not built
yet — those routes return 501 by design.

## Still to come

- Gmail OAuth for both accounts, `watch` subscription, ingest
- Triage and drafting against `settings/rules.md`
- Dashboard, behind Cloudflare Access
- Meta Cloud API connection via coexistence
- Mac Studio bridge for personal WhatsApp, read-only
- Bill extraction from PDFs, due-date reminders
