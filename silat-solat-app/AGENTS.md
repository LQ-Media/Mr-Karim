# Silat & Solat (LQ-Media/Mr-Karim)

Next.js 16, App Router. Read `node_modules/next/dist/docs/` before writing Next
code: `params`, `searchParams` and `cookies()` are async.

Rules:
- Bahasa Melayu first, English second. Every visible string is written as a
  pair: `t("Jadual", "Schedule")` (server: `getT()`, client: `makeT(lang)`).
  Silat terms stay Malay in both.
- Public pages work without signing in. Member pages call `requireUser`;
  instructor and admin pages `requireInstructor` / `requireAdmin`. Every server
  action checks who is asking itself; never trust a hidden field.
- Instructors see only their assigned branch + stream (`instructorScope`).
  Sisters' rosters are assigned to female instructors only.
- Children never get a login; they are profiles on a parent's account.
- Media consent decides whether anyone appears in a public video.
- All money goes to the one Silat n Solat account; `payments.purpose` keeps
  campaign money reportable. Never use another business's Stripe keys.
- Draft Tanya Ustaz answers stay private until the Ustaz approves them.
- Sash syllabus item ids are stored in `signoffs`: add new ids, never rename.
- Timezone Asia/Singapore (`lib/time.js`, `todaySgt()`).
- Fonts are self-hosted (@fontsource) so builds never reach Google Fonts.
