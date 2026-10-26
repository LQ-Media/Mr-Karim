import Link from "next/link";
import { requireInstructor, instructorScope, isAdmin } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { getClasses, sortFromToday, todaySgt, nextDateFor } from "@/lib/data";
import { query } from "@/lib/db";
import { checkinPath } from "@/lib/checkin";
import { qrSvg } from "@/lib/qr";
import { siteOrigin } from "@/lib/origin";
import { BY_SLUG, STREAMS } from "@/lib/branches";
import { DAYS, clock, dateLabel } from "@/lib/tr";
import { sash } from "@/lib/sashes";
import { nowInSgt } from "@/lib/time";
import { toggleAttendance } from "@/app/instructor-actions";
import { BranchDot, Empty, Notice } from "@/components/Bits";
import AnnounceForm from "@/components/AnnounceForm";

export const metadata = { title: "Mod jurulatih" };

export default async function Instructor({ searchParams }) {
  const user = await requireInstructor();
  const t = await getT();
  const lang = t.lang;
  const sp = await searchParams;
  const scope = await instructorScope(user);
  const classes = sortFromToday(
    (await getClasses()).filter((c) => scope === null || scope.some((s) => s.branch === c.branch && s.stream === c.stream))
  );
  if (!classes.length) {
    return (
      <div className="pt-6">
        <Notice>{t("Admin belum menetapkan cawangan dan kelas anda.", "An admin hasn't assigned you a branch and class yet.")}</Notice>
      </div>
    );
  }
  const today = todaySgt();
  const cls = classes.find((c) => c.id === sp?.class) || classes[0];
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp?.day || "") ? sp.day : cls.weekday === nowInSgt().weekday ? today : nextDateFor(cls.weekday);
  const isToday = day === today;
  const origin = await siteOrigin();
  const qr = isToday ? await qrSvg(`${origin}${checkinPath(cls.id, day)}`) : null;

  const { rows: roster } = await query(
    `select m.id::text, m.display_name, m.full_name, m.level, m.stripes, m.medical_notes,
       exists(select 1 from attendance a where a.member_id = m.id and a.class_id = $3 and a.day = $4) as here
     from members m where m.branch = $1 and m.stream = $2 and m.status = 'active' order by m.display_name`,
    [cls.branch, cls.stream, cls.id, day]
  );
  const present = roster.filter((r) => r.here).length;
  const myBranches = scope === null ? Object.keys(BY_SLUG) : [...new Set(scope.map((s) => s.branch))];

  return (
    <div className="ss-rise flex flex-col gap-4">
      <section className="-mx-5 flex flex-col gap-3 border-b-[6px] bg-ink px-5 pb-4 pt-4 text-page lg:mx-0 lg:mt-5 lg:rounded-[18px]" style={{ borderColor: BY_SLUG[cls.branch].color === "#FFFFFF" ? "#E2D8C2" : BY_SLUG[cls.branch].color }}>
        <p className="kicker" style={{ color: "#D9A521" }}>{t("Mod jurulatih", "Instructor mode")}</p>
        <h1 className="text-[24px]" style={{ color: "#F6F0E1" }}>
          {BY_SLUG[cls.branch].short} · {STREAMS[cls.stream][lang]}
        </h1>
        <p className="text-[14px] text-[#DCD3BF]">{dateLabel(day, lang)} · {clock(cls.starts, lang)}</p>
        <form className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="cls">{t("Kelas", "Class")}</label>
          <select id="cls" name="class" defaultValue={cls.id} className="input flex-1 text-[14px]">
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{BY_SLUG[c.branch].short} · {STREAMS[c.stream][lang]} · {DAYS[lang][c.weekday]} {clock(c.starts, lang)}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="day">{t("Tarikh", "Date")}</label>
          <input id="day" type="date" name="day" defaultValue={day} className="input w-auto text-[14px]" />
          <button className="btn btn-gold btn-sm">{t("Buka", "Open")}</button>
        </form>
      </section>

      {isToday ? (
        <details className="card p-4" open>
          <summary className="cursor-pointer text-[15px] font-extrabold">{t("Kod QR daftar hadir hari ini", "Today's check-in QR code")}</summary>
          <div className="mt-3 flex flex-col items-center gap-2">
            <div className="w-[240px] rounded-[12px] bg-white p-2" role="img" aria-label={t("Kod QR daftar hadir", "Check-in QR code")} dangerouslySetInnerHTML={{ __html: qr }} />
            <p className="text-center text-[13px] text-muted">{t("Ahli imbas dengan kamera telefon. Sah untuk hari ini sahaja.", "Members scan with their phone camera. Valid today only.")}</p>
          </div>
        </details>
      ) : (
        <Notice>{t("Kod QR hanya dipaparkan pada hari kelas. Anda masih boleh tanda kehadiran di bawah.", "The QR code only shows on the class day. You can still mark attendance below.")}</Notice>
      )}

      <div className="flex items-baseline justify-between">
        <h2 className="text-[20px]">{t("Senarai nama", "Roster")}</h2>
        <span className="text-[14px] font-extrabold">{present} / {roster.length} {t("hadir", "present")}</span>
      </div>
      {roster.length === 0 ? (
        <Empty>{t("Belum ada ahli berdaftar untuk kelas ini.", "No members registered for this class yet.")}</Empty>
      ) : (
        <ul className="overflow-hidden rounded-[14px] bg-surface">
          {roster.map((r) => (
            <li key={r.id} className="flex items-center gap-2.5 border-b border-hairline-2 px-4 py-2 last:border-0">
              <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ background: sash(r.level).color, border: "1px solid #8F8572" }} />
              <Link href={`/instructor/member/${r.id}`} className="flex flex-1 flex-col text-ink">
                <strong className="text-[15px]">{r.display_name}</strong>
                {r.medical_notes ? <span className="text-[12px] font-bold text-warn-fg">⚕ {r.medical_notes}</span> : null}
              </Link>
              <form action={toggleAttendance}>
                <input type="hidden" name="classId" value={cls.id} />
                <input type="hidden" name="day" value={day} />
                <input type="hidden" name="memberId" value={r.id} />
                <input type="hidden" name="present" value={r.here ? "0" : "1"} />
                <button aria-pressed={r.here} className="min-h-[38px] rounded-[10px] border-[1.5px] border-ink px-3 text-[13px] font-extrabold" style={r.here ? { background: "#17140F", color: "#F6F0E1" } : undefined}>
                  {r.here ? t("Hadir", "Present") : t("Tanda", "Mark")}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[13px] text-muted">{t("Ketik nama untuk tandatangan sukatan dan nota.", "Tap a name to sign off syllabus and add notes.")}</p>

      <Link href="/instructor/grading" className="btn btn-gold">{t("Hari gred", "Grading days")}</Link>

      <section className="card p-4">
        <h2 className="mb-3 text-[19px]">{t("Pengumuman", "Announcement")}</h2>
        <AnnounceForm lang={lang} branches={myBranches} allowAll={isAdmin(user)} />
      </section>
      <div className="flex items-center gap-2 text-[13px] text-muted">
        {myBranches.map((b) => <BranchDot key={b} slug={b} />)}
        <span>{t("Cawangan anda", "Your branches")}</span>
      </div>
    </div>
  );
}
