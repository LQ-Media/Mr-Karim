import { getT } from "@/lib/i18n";
import { getUser, adminEmails } from "@/lib/auth";
import { query } from "@/lib/db";
import { BRANCHES, BY_SLUG, STREAMS } from "@/lib/branches";
import { SASHES, NO_SASH } from "@/lib/sashes";
import { setRole, assign, setMemberLevel, setMemberStatus } from "@/app/admin-actions";
import { BranchDot } from "@/components/Bits";
import Link from "next/link";

export const metadata = { title: "Admin · Ahli" };

export default async function People({ searchParams }) {
  const t = await getT();
  const lang = t.lang;
  const sp = await searchParams;
  const me = await getUser();
  const q = String(sp?.q || "").trim();
  const like = `%${q.toLowerCase()}%`;
  const [users, assigns, members] = await Promise.all([
    query(
      `select id::text, name, email, role from app_users
       where ($1 = '' or lower(name) like $2 or lower(email) like $2)
       order by case role when 'admin' then 0 when 'instructor' then 1 else 2 end, name limit 60`,
      [q, like]
    ),
    query("select user_id::text, branch, stream from instructor_assignments"),
    query(
      `select m.id::text, m.full_name, m.branch, m.stream, m.level, m.status, u.email from members m join app_users u on u.id = m.account_id
       where ($1 = '' or lower(m.full_name) like $2 or lower(u.email) like $2) order by m.branch, m.full_name limit 100`,
      [q, like]
    ),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[30px]">{t("Ahli & jurulatih", "People")}</h1>
      <form role="search" className="flex gap-2">
        <input name="q" defaultValue={q} placeholder={t("Cari nama atau e-mel", "Search name or email")} aria-label={t("Cari", "Search")} className="input flex-1" />
        <button className="btn btn-ink btn-sm">{t("Cari", "Search")}</button>
      </form>

      <h2 className="text-[20px]">{t("Akaun", "Accounts")}</h2>
      <p className="text-[13px] text-muted">
        {t(
          "Jadikan seseorang jurulatih, kemudian tetapkan cawangan dan aliran mereka. Kelas Muslimah hanya untuk jurulatih wanita.",
          "Make someone an instructor, then assign their branch and stream. Sisters' classes go to female instructors only."
        )}
      </p>
      {users.rows.map((row) => {
        const fixed = adminEmails().includes(row.email.toLowerCase());
        const u = fixed ? { ...row, role: "admin" } : row;
        const mine = assigns.rows.filter((a) => a.user_id === u.id);
        return (
          <div key={u.id} className="flex flex-col gap-2 rounded-[14px] bg-surface p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex flex-1 flex-col">
                <strong className="text-[15px]">{u.name || u.email}</strong>
                <span className="text-[12px] text-muted">{u.email}</span>
              </span>
              <form action={setRole} className="flex gap-1.5">
                <input type="hidden" name="userId" value={u.id} />
                <select name="role" defaultValue={u.role} aria-label={t("Peranan", "Role")} className="input w-auto py-1.5 text-[13px]" disabled={u.id === me.id || fixed}>
                  <option value="member">{t("Ahli", "Member")}</option>
                  <option value="instructor">{t("Jurulatih", "Instructor")}</option>
                  <option value="admin">Admin</option>
                </select>
                {u.id !== me.id && !fixed ? <button className="btn btn-line btn-sm">{t("Simpan", "Save")}</button> : null}
              </form>
            </div>
            {u.role === "instructor" ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {mine.map((a) => (
                  <form key={`${a.branch}-${a.stream}`} action={assign}>
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="branch" value={a.branch} />
                    <input type="hidden" name="stream" value={a.stream} />
                    <input type="hidden" name="remove" value="1" />
                    <button className="chip" title={t("Buang", "Remove")}>
                      <BranchDot slug={a.branch} size={9} /> {BY_SLUG[a.branch].short} · {STREAMS[a.stream][lang]} ✕
                    </button>
                  </form>
                ))}
                <form action={assign} className="flex gap-1.5">
                  <input type="hidden" name="userId" value={u.id} />
                  <select name="branch" aria-label={t("Cawangan", "Branch")} className="input w-auto py-1.5 text-[13px]">
                    {BRANCHES.map((b) => <option key={b.slug} value={b.slug}>{b.short}</option>)}
                  </select>
                  <select name="stream" aria-label={t("Aliran", "Stream")} className="input w-auto py-1.5 text-[13px]">
                    {Object.entries(STREAMS).map(([k, v]) => <option key={k} value={k}>{v[lang]}</option>)}
                  </select>
                  <button className="btn btn-ink btn-sm">+</button>
                </form>
              </div>
            ) : null}
          </div>
        );
      })}

      <h2 className="text-[20px]">{t("Profil latihan", "Training profiles")}</h2>
      <p className="text-[13px] text-muted">{t("Tetapkan bengkung semasa untuk pelajar sedia ada pada hari pertama.", "Set the current sash for existing students on day one.")}</p>
      {members.rows.map((m) => (
        <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-[14px] bg-surface p-3" style={{ opacity: m.status === "active" ? 1 : 0.6 }}>
          <BranchDot slug={m.branch} />
          <Link href={`/progress/${m.id}`} className="flex flex-1 flex-col text-ink">
            <strong className="text-[15px]">{m.full_name}</strong>
            <span className="text-[12px] text-muted">{STREAMS[m.stream][lang]} · {m.email}</span>
          </Link>
          <form action={setMemberLevel} className="flex gap-1.5">
            <input type="hidden" name="memberId" value={m.id} />
            <select name="level" defaultValue={m.level} aria-label={t("Bengkung", "Sash")} className="input w-auto py-1.5 text-[13px]">
              {[NO_SASH, ...SASHES].map((s) => <option key={s.level} value={s.level}>{lang === "en" ? s.en : s.ms}</option>)}
            </select>
            <button className="btn btn-line btn-sm">{t("Tetapkan", "Set")}</button>
          </form>
          <form action={setMemberStatus}>
            <input type="hidden" name="memberId" value={m.id} />
            <input type="hidden" name="status" value={m.status === "active" ? "paused" : "active"} />
            <button className="text-[12px] font-bold text-accent-press">{m.status === "active" ? t("Jeda", "Pause") : t("Aktifkan", "Activate")}</button>
          </form>
        </div>
      ))}
    </div>
  );
}
