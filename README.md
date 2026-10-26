# Silat & Solat

The grassroots web app for **Silat & Solat · Perguruan Si Rumpun Padi**, the
mosque-based silat school led by Ustaz Mohammad Bahrul-Ulum. Lepas silat, solat.

Bahasa Melayu first, English on a toggle. Installs to a phone's home screen
(PWA); a store app can wrap it later.

## What's in it

**Public (no sign-in)**

- Home, the five-mosque **schedule** in each branch's colour, with the prayer
  that falls in each class (MUIS method), and a page per **branch**
- **Try a class**: book a free trial (no account needed)
- **Learn**: video library by sash level, **Tabata timer**, **Quran reader**
  (text, translation, audio, tajweed), **prayer times**, **Tanya Ustaz Silat**,
  and the school's story and heritage
- **Book**, **monthly support** (S$10–S$100) and **campaigns**, paid by
  **PayNow QR** (made in the app, no fees) or **card** (Stripe)

**Members (Sign in with Google)**

- One account per family; children are profiles, never logins
- **QR check-in**: the instructor shows today's code, members scan it with the
  phone camera
- **Sash progress** on the standard six-sash ladder (no sash → Putih → Kuning →
  Hijau → Biru → Merah → Hitam), syllabus checklist, instructor notes
- **Grading** days, results and bilingual **certificates** (save as PDF)
- **Announcements** for their branch and class
- Profile: family, media consent, monthly support plan, delete account

**Instructors** (only their own branch and stream)

- Roster with tap-to-mark attendance and the class QR code
- Syllabus sign-off, notes, kids' stripes
- Open grading days, record results, set their branch's grading frequency
- Post announcements

**Admin**

- Overview: members per branch, trial bookings, PayNow to confirm, new questions,
  black-sash approvals, volunteers, setup checklist
- Classes (times, confirmed, active), people (roles, instructor assignments,
  starting sash for existing students), content (announcements, videos, Q&A,
  campaigns), payments (mark paid, CSV export), default grading frequency

## Run it

```bash
npm install
npm run dev        # http://localhost:3000, public pages work with no settings
npm test
npm run lint
```

Copy `.env.example` to `.env.local` and fill in what you need. With
`DATABASE_URL` set, tables are created and the starting timetable, videos and
campaigns are seeded on first use.

## Deploy on Railway

1. **New project › Deploy from GitHub repo** › `LQ-Media/Mr-Karim`.
   Railway uses the `Dockerfile` and `railway.json` (health check `/api/health`).
2. **+ New › Database › PostgreSQL** in the same project.
3. In the app service's **Variables**, add:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (reference variable)
   - `SESSION_SECRET` = a long random string
   - `ADMIN_EMAILS` = the Gmail addresses that should be admin
4. **Settings › Networking › Generate Domain**. You get
   `something.up.railway.app`. Put it in `APP_ORIGIN` (with `https://`).
5. **Google sign-in**: in [Google Cloud Console](https://console.cloud.google.com/)
   create a project › APIs & Services › OAuth consent screen (External, app name
   "Silat & Solat") › Credentials › Create OAuth client ID › Web application.
   Authorised redirect URI: `<APP_ORIGIN>/api/auth/google/callback`. Copy the
   client ID and secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
6. **PayNow**: `PAYNOW_UEN` (or `PAYNOW_MOBILE`) of the Silat n Solat account,
   and `PAYNOW_NAME` as it appears to payers.
7. **Cards (optional)**: Silat n Solat's own Stripe account. Set
   `STRIPE_SECRET_KEY`, then add a webhook endpoint `<APP_ORIGIN>/api/stripe/webhook`
   for `checkout.session.completed`, `invoice.paid` and
   `customer.subscription.deleted`, and set `STRIPE_WEBHOOK_SECRET`. Turn on the
   customer portal in Stripe so supporters can manage their plans.

**Your own domain later**: buy it, then Railway › Settings › Networking ›
Custom Domain, add the CNAME it shows at your registrar, and update
`APP_ORIGIN` and the Google redirect URI.

## Before going public

- The Ustaz confirms class times (admin › Classes › tick Confirmed)
- He reviews the ten Tanya Ustaz drafts (admin › Content › Load drafts), then
  publishes them, or set `FAQ_APPROVED=1` to show them as drafted
- Replace the stand-in rice-stalk mark with the official logo
  (`components/Logo.js`, `public/icon-*.png`, `app/icon.png`, `app/apple-icon.png`)
- Set the real book price (`BOOK_PRICE_CENTS`)
- `ALLOW_INDEXING=1` when it should appear in search results

## Where things are

| | |
|---|---|
| `lib/branches.js` | the five mosques, their colours, the starting timetable |
| `lib/sashes.js` | the sash ladder and syllabus (item ids are stored; never reuse one) |
| `lib/faq.js` | the drafted Tanya Ustaz answers |
| `lib/paynow.js` | PayNow QR payloads (SGQR) |
| `lib/stripe.js` | Stripe Checkout and webhooks, over plain HTTPS |
| `lib/checkin.js` | signed, same-day check-in links |
| `lib/db.js` | schema and seed |
| `app/*-actions.js` | every change, each checking who is asking |
| `components/quran`, `components/SolatWidget.js` | shared with the LQK apps |
