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

> **Read this before clicking.** Google expires refresh tokens after **7 days**
> for OAuth apps with user type *External* and publishing status *Testing*.
> An always-on agent configured that way dies weekly. The way around it is
> user type **Internal**, which Workspace domains can select and which is
> exempt from both the 7-day expiry and Google's verification review.
>
> Internal only covers accounts inside `littlequrankids.sg`. A personal Gmail
> cannot authorise against an Internal app — see *Personal Gmail* below.

At **console.cloud.google.com**, signed in as `karim@littlequrankids.sg`:

1. **Create a new project** and make sure its Organisation is
   `littlequrankids.sg`, not "No organisation". The Internal option does not
   appear otherwise, and changing it later means starting over.
2. **APIs & Services → Library** → enable the **Gmail API**.
3. **APIs & Services → OAuth consent screen** → User Type **Internal** →
   Create. Fill in app name and support email; nothing else is required.
4. **Data Access** → Add scope → `https://www.googleapis.com/auth/gmail.readonly`
5. **Credentials → Create credentials → OAuth client ID → Web application.**
   Authorised redirect URI: `http://localhost:8788/callback`
6. Add the client id and secret to `.env`:

```
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
```

Then authorise the work inbox:

```sh
npm run auth:google
```

Copy the printed URL into the browser, sign in as the account you are
connecting, and approve. Leave the terminal running while you do — it is
listening for the redirect.

The token is written to `.secrets/gmail-work.txt`, never printed. Upload it
without looking at it, then delete the local copy:

```sh
npx wrangler secret put GMAIL_REFRESH_TOKEN_WORK < .secrets/gmail-work.txt
rm .secrets/gmail-work.txt
```

That token grants read access to the mailbox. Treat it like a password: do not
`cat` it, screenshot it, or paste it anywhere.

### Personal Gmail

An Internal app cannot authorise it. Three ways round, in order of preference:

- **Pull it into the work inbox.** Gmail → Settings → Accounts → *Check mail
  from other accounts* → add the personal address over POP. One OAuth
  connection then covers both, and the imported mail arrives labelled. Costs
  some latency: Gmail's own fetch interval is its own business, sometimes an
  hour.
- **Forward selectively.** A filter on the personal account forwarding only
  what matters — bank, government, bills — to the work address. Less noise
  than a full import, but you maintain the filter.
- **A second External OAuth app**, accepting re-authorisation every 7 days.
  Works, but it is a recurring chore and the system is silently blind between
  the expiry and your noticing.

Whichever you choose, `GMAIL_REFRESH_TOKEN_PERSONAL` stays unset until it is
sorted. The Worker skips inboxes with no refresh token, so polling the work
account alone works fine in the meantime.

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
  -H "x-bridge-secret: $(cat .secrets/bridge-secret.txt)"
```

Returns counts of what it fetched, stored and triaged, plus any errors. Then
`/health` again to see the totals climb.

By default it looks back fifteen minutes, matching cron. To pull a real sample
worth judging rather than waiting for mail to arrive, widen it — `minutes` is
capped at a week, `max` at 100 messages per inbox:

```sh
curl -X POST "https://mr-karim.<subdomain>.workers.dev/admin/poll?minutes=1440&max=40" \
  -H "x-bridge-secret: $(cat .secrets/bridge-secret.txt)"
```

Reading `$(cat ...)` into the header keeps the secret off screen, so the
command is safe to screenshot.

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
