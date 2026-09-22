# Mr Karim — personal AI chief-of-staff

An always-on agent that triages email and WhatsApp, drafts replies for approval,
and tracks bills and deadlines. Claude runs the judgement; a dashboard is the
only surface the operator touches.

**Status:** design locked, not yet built.

---

## 1. Decisions

| Area | Decision |
|---|---|
| Autonomy | **Draft only.** Nothing is ever sent without explicit human approval. |
| Hosting | Cloudflare Workers + D1, plus a small always-on bridge on the Mac Studio |
| Domain | Subdomain of `littlequrankids.sg`, DNS moved to Cloudflare |
| Business WhatsApp | Meta Cloud API via coexistence — number stays on the phone |
| Personal WhatsApp | Read-only, via a linked-device session on the Mac Studio |
| Email | Two Gmail accounts — business Workspace + personal |
| Email volume | Under 50/day combined |
| Bills | Detect, log, remind ahead of due date |
| Attachments | PDFs parsed, primarily to extract bill amounts and due dates |
| WhatsApp groups | Excluded |
| Models | Haiku 4.5 triage, Opus 5 drafting |

### Priority senders

Never-miss categories, in the operator's own ranking:

1. Banks and payment providers
2. Government — IRAS, CPF, MOM, ACRA
3. Suppliers, landlord, utilities

Parent and customer conversations were deliberately **not** listed for email —
they arrive over WhatsApp. Email triage is therefore weighted toward money and
compliance; WhatsApp triage is weighted toward customers.

---

## 2. Topology

```
┌──────────────────────┐
│  Mac Studio          │
│  (always on)         │        authenticated HTTPS push
│                      │ ──────────────────────────────┐
│  personal WhatsApp   │                               │
│  linked session      │                               ▼
│  read-only bridge    │                  ┌─────────────────────────┐
└──────────────────────┘                  │  Cloudflare Workers     │
                                          │                         │
Meta Cloud API ──── webhook ─────────────▶│  ingest → triage → draft│
Gmail push (Pub/Sub) ─── webhook ────────▶│  dashboard (phone-first)│
                                          │  cron: reminders, sweep │
                                          │  D1: messages, bills    │
                                          └────────────┬────────────┘
                                                       │
                                                       ▼
                                                  Claude API
```

### Why the Mac Studio exists in this design

A WhatsApp linked-device session is a long-lived stateful connection. Workers
are short-lived and stateless, so the session cannot live there. The Mac holds
exactly one thing — the personal WhatsApp link — and forwards new messages up.
Everything else is serverless.

If the Mac is offline, personal WhatsApp visibility stops. Nothing else is
affected.

### Linked-device facts this relies on

- A linked device is a companion to the account. The WhatsApp app on the phone
  is unaffected and keeps working, including while the phone is off.
- Four companion slots exist per account. Each browser signed into WhatsApp Web
  consumes one. The bridge takes one slot.
- Linked devices are logged out after roughly 14 days of inactivity. An
  always-on machine never reaches that threshold.
- The bridge appears under Settings → Linked Devices on the phone. Expected.

### Known risk, accepted

Automating WhatsApp Web is contrary to WhatsApp's terms of service regardless of
implementation. This design takes the mildest available profile — read-only, no
sending, low volume, stable single device — but the risk is not zero. Personal
WhatsApp drafts are surfaced in the dashboard for manual copy-paste; the bridge
never transmits.

---

## 3. Components

1. **Ingest** — Gmail `watch` + Pub/Sub push (near-instant, free); Meta Cloud API
   webhook; Mac bridge push endpoint.
2. **Store** — Cloudflare D1. Every message, its classification, its draft, and
   what the operator did with it. Doubles as memory and audit trail.
3. **Triage** — Haiku 4.5 classifies everything: category, urgency, needs-reply,
   is-this-a-bill. Cheap, runs on every item.
4. **Draft** — Opus 5, only on items triage flags as needing a considered reply.
5. **Settings** — a Markdown file of rules in plain language: priority senders,
   tone, business hours, what counts as a bill, what to ignore. Loaded into every
   prompt, editable from the dashboard, no redeploy.
6. **Dashboard** — phone-first. A queue of items needing attention, one-tap
   approve/edit/send, plus a bills-and-deadlines tab.
7. **Outbound** — approved replies go out via Gmail API or the Cloud API.
   Personal WhatsApp is excluded from this path by design.

---

## 4. Cost

Monthly, USD.

| Item | Cost |
|---|---|
| Cloudflare Workers Paid | $5 |
| Cloudflare D1 + KV | $0 — free tier far exceeds this volume |
| Mac Studio bridge | $0 — hardware already running |
| Gmail API | $0 |
| WhatsApp — replies within the 24h service window | $0 |
| Meta Cloud API, direct (no BSP) | $0 |
| Subdomain of an owned domain | $0 |
| Claude API — email (<50/day, 2 accounts) | ~$12–18 |
| Claude API — WhatsApp | ~$15–30, pending volume |
| **Total** | **~$32–53** |

Rates used: Haiku 4.5 at $1/$5 per million tokens in/out; Opus 5 at $5/$25.
Prompt caching applies to the settings block on every call and pulls the input
side toward the low end.

**The Claude Pro subscription does not cover any of this.** Server-side API
usage bills separately and needs its own API key and payment method in the
Anthropic Console.

Only outbound-initiated WhatsApp (template messages, roughly $0.02–0.09 each at
Singapore rates) would add cost. Replying inside the 24-hour window after
someone messages first is free, which is the entire use case here.

---

## 5. Build order

Meta Business verification is already done, which removes the longest lead time.

1. Cloudflare account, D1 schema, subdomain and DNS
2. Gmail OAuth for both accounts, `watch` subscription, ingest endpoint
3. Triage and drafting pipeline, settings file, first prompts
4. Dashboard — queue view, approve/edit/send, bills tab
5. Meta Cloud API connection via coexistence, business WhatsApp ingest
6. Mac Studio bridge, personal WhatsApp read-only
7. Bill extraction from PDFs, due-date reminders on cron

Email end-to-end is the first milestone worth looking at. It proves whether the
agent's notion of "important" matches the operator's, which is the assumption the
whole system rests on.

---

## 6. Security

- Gmail OAuth refresh tokens, the Meta access token, the Claude API key and the
  bridge's shared secret are all secrets. Workers secrets and macOS Keychain
  respectively — never in the repo.
- The WhatsApp session credentials on the Mac are equivalent to a logged-in
  session. Encrypted at rest, restrictive file permissions.
- D1 holds message content, including personal correspondence. Retention policy
  is a setting, defaulting to 90 days with a scheduled purge.
- Message content is sent to the Claude API. It leaves the operator's
  infrastructure. Anthropic does not train on API traffic by default.
- The dashboard is single-user and must be authenticated. Cloudflare Access
  against the Workspace account is the cheapest correct answer.
- Little Quran Kids correspondence may reference minors. Retention and access
  controls are treated as a requirement, not a nicety.

---

## 7. Open

- Actual WhatsApp message volume, business and personal — the only number still
  missing from the cost model.
- Which providers send the recurring bills, so extraction can be tuned to their
  formats.
- Whether bill data should eventually export to an accounting tool.
