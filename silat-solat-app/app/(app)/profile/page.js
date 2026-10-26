import Link from "next/link";
import { requireUser, isAdmin, isInstructor } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { getFamily } from "@/lib/data";
import { query } from "@/lib/db";
import { BY_SLUG, STREAMS } from "@/lib/branches";
import { sashName } from "@/lib/sashes";
import { sgd } from "@/lib/money";
import { BranchDot, PageTitle, Notice } from "@/components/Bits";
import { signOut, deleteAccount } from "@/app/actions";
import { manageSupport } from "@/app/member-actions";
import AccountForm from "./AccountForm";

export const metadata = { title: "Profil" };

export default async function Profile({ searchParams }) {
  const user = await requireUser("/profile");
  const t = await getT();
  const lang = t.lang;
  const sp = await searchParams;
  const family = await getFamily(user.id);
  const plans = (
    await query(
      `select ref, amount_cents, method, status, details from payments
       where user_id = $1 and monthly and status = 'paid' and not (coalesce(details,'{}'::jsonb) ? 'renewal')
       order by id desc`,
      [user.id]
    )
  ).rows;

  return (
    <div className="ss-rise flex flex-col gap-4">
      <PageTitle kicker={user.email} title={user.name || t("Profil", "Profile")} />
      {sp?.portal ? <Notice tone="warn">{t("Halaman pengurusan Stripe tidak dapat dibuka.", "Couldn't open Stripe's management page.")}</Notice> : null}

      <section className="card p-4">
        <AccountForm lang={lang} user={user} />
      </section>

      <section className="card overflow-hidden">
        <h2 className="kicker px-4 pb-1 pt-3 text-muted">{t("Keluarga", "Family")}</h2>
        {family.map((m) => (
          <Link key={m.id} href={`/register?id=${m.id}`} className="flex items-center gap-2.5 border-b border-hairline-2 px-4 py-3 text-ink">
            <BranchDot slug={m.branch} />
            <span className="flex flex-1 flex-col">
              <strong className="text-[15px]">{m.display_name}</strong>
              <span className="text-[13px] text-muted">{BY_SLUG[m.branch].short} · {STREAMS[m.stream][lang]} · {m.media_consent ? t("kebenaran media: ya", "media consent: yes") : t("kebenaran media: tidak", "media consent: no")}</span>
            </span>
            <span className="text-[12px] text-muted">{sashName(m.level, lang)}</span>
          </Link>
        ))}
        <Link href="/register" className="block px-4 py-3 text-[14px] font-extrabold text-accent-press">+ {t("Tambah ahli keluarga", "Add a family member")}</Link>
      </section>

      <section className="card flex flex-col gap-2 p-4">
        <span className="kicker text-muted">Sahabat Padi</span>
        {plans.length ? (
          plans.map((p) => (
            <div key={p.ref} className="flex items-center justify-between">
              <strong>{sgd(p.amount_cents)} {t("sebulan", "a month")} · {p.method === "card" ? t("kad", "card") : "PayNow"}</strong>
              {p.details?.ended ? <span className="text-[13px] text-muted">{t("Dibatalkan", "Cancelled")}</span> : null}
            </div>
          ))
        ) : (
          <p className="text-[14px] text-muted">{t("Tiada pelan sokongan bulanan.", "No monthly support plan.")}</p>
        )}
        <div className="flex gap-2">
          {plans.some((p) => p.method === "card" && !p.details?.ended) ? (
            <form action={manageSupport}>
              <button className="btn btn-line btn-sm">{t("Urus pelan", "Manage plan")}</button>
            </form>
          ) : null}
          <Link href="/support" className="btn btn-gold btn-sm">{t("Sokong", "Support")}</Link>
        </div>
      </section>

      {isInstructor(user) ? (
        <div className="flex flex-col gap-2">
          <Link href="/instructor" className="btn btn-ink">{t("Mod jurulatih", "Instructor mode")}</Link>
          {isAdmin(user) ? <Link href="/admin" className="btn btn-line">{t("Panel admin", "Admin panel")}</Link> : null}
        </div>
      ) : null}

      <Link href="/privacy" className="text-[14px] font-bold text-accent-press">{t("Notis privasi", "Privacy notice")}</Link>
      <form action={signOut}>
        <button className="btn btn-line w-full">{t("Log keluar", "Sign out")}</button>
      </form>
      <details className="rounded-[14px] bg-danger-bg p-4">
        <summary className="cursor-pointer text-[14px] font-extrabold text-danger-fg">{t("Padam akaun", "Delete account")}</summary>
        <p className="my-2 text-[14px] text-danger-fg">
          {t("Ini memadam semua profil keluarga, kehadiran dan kemajuan. Tidak boleh dibatalkan.", "This deletes every family profile, attendance and progress record. It can't be undone.")}
        </p>
        <form action={deleteAccount}>
          <button className="btn btn-sm" style={{ background: "#8A2A22", color: "#fff" }}>{t("Padam akaun saya", "Delete my account")}</button>
        </form>
      </details>
    </div>
  );
}
