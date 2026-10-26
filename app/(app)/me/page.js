import Link from "next/link";
import Icon from "@/components/Icon";
import ClassCard from "@/components/ClassCard";
import { Notice, SashChip } from "@/components/Bits";
import { requireUser, firstName, isInstructor, isAdmin } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { getFamily, getClasses, sortFromToday, withPrayer, memberProgress, announcementsFor, nextGrading } from "@/lib/data";
import { BY_SLUG, STREAMS } from "@/lib/branches";
import { sashName } from "@/lib/sashes";
import { dateLabel } from "@/lib/tr";

export const metadata = { title: "Laman saya" };

export default async function Me({ searchParams }) {
  const user = await requireUser("/me");
  const t = await getT();
  const lang = t.lang;
  const sp = await searchParams;
  const family = await getFamily(user.id);

  if (!family.length) {
    return (
      <div className="ss-rise flex flex-col gap-4 pt-6">
        <h1 className="text-[30px]">{t(`Assalamualaikum, ${firstName(user)}`, `Assalamualaikum, ${firstName(user)}`)}</h1>
        <p className="text-[15px] leading-relaxed text-muted">
          {t("Daftar diri anda atau anak anda untuk mula merekod kehadiran dan kemajuan bengkung.", "Register yourself or your children to start recording attendance and sash progress.")}
        </p>
        <Link href="/register" className="btn btn-gold">{t("Daftar sekarang", "Register now")}</Link>
        <StaffLinks user={user} t={t} />
        <Link href="/profile" className="text-center text-[14px] font-bold text-accent-press">{t("Profil & tetapan", "Profile & settings")}</Link>
      </div>
    );
  }

  const m = family.find((x) => x.id === sp?.m) || family[0];
  const [classes, progress, news, grading] = await Promise.all([
    getClasses().then((cs) => withPrayer(sortFromToday(cs.filter((c) => c.branch === m.branch && c.stream === m.stream)))),
    memberProgress(m),
    announcementsFor(family, 1),
    nextGrading(m.branch),
  ]);
  const next = classes[0];
  const pct = progress.itemsTotal ? Math.round((progress.itemsDone / progress.itemsTotal) * 100) : 100;

  return (
    <div className="ss-rise flex flex-col gap-4">
      <section className="-mx-5 flex flex-col gap-3 bg-ink px-5 pb-4 pt-4 text-page lg:mx-0 lg:mt-5 lg:rounded-[18px]">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[13px] text-[#DCD3BF]">Assalamualaikum,</span>
            <strong className="font-heading text-[24px] font-semibold">{firstName(user)}</strong>
          </div>
          <Link href="/news" aria-label={t("Pengumuman", "Announcements")} className="flex h-11 w-11 items-center justify-center text-page">
            <Icon name="bell" size={24} />
          </Link>
        </div>
        {family.length > 1 ? (
          <nav aria-label={t("Ahli keluarga", "Family members")} className="flex flex-wrap gap-2">
            {family.map((x) => (
              <Link key={x.id} href={`/me?m=${x.id}`} aria-current={x.id === m.id ? "true" : undefined} className="min-h-[34px] rounded-full px-3.5 py-1.5 text-[13px] font-extrabold" style={x.id === m.id ? { background: "#D9A521", color: "#17140F" } : { border: "1px solid #5E564A", color: "#F6F0E1" }}>
                {x.display_name}
              </Link>
            ))}
          </nav>
        ) : null}
      </section>

      {sp?.saved ? <Notice tone="ok">{t("Disimpan.", "Saved.")}</Notice> : null}

      <section className="flex flex-col gap-2 rounded-[16px] bg-surface p-4" style={{ borderTop: `6px solid ${BY_SLUG[m.branch].color === "#FFFFFF" ? "#E2D8C2" : BY_SLUG[m.branch].color}` }}>
        <span className="kicker text-muted">{t("Kelas seterusnya", "Next class")} · {m.display_name}</span>
        {next ? (
          <ClassCard c={next} lang={lang} prayer={next.prayer} />
        ) : (
          <p className="text-[14px] text-muted">{t("Tiada kelas untuk aliran ini lagi.", "No class for this stream yet.")}</p>
        )}
        <p className="flex items-start gap-2 text-[13px] leading-relaxed text-muted">
          <Icon name="camera" size={18} />
          {t("Di kelas, imbas kod QR jurulatih dengan kamera telefon untuk daftar hadir.", "At class, scan the instructor's QR code with your phone camera to check in.")}
        </p>
      </section>

      <Link href={`/progress/${m.id}`} className="flex flex-col gap-2.5 rounded-[16px] bg-surface p-4 text-ink">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SashChip level={m.level} stripes={m.stripes} lang={lang} />
          <span className="text-[13px] font-extrabold">{STREAMS[m.stream][lang]}</span>
        </div>
        {progress.target ? (
          <>
            <div className="flex justify-between text-[15px]">
              <strong>{t("Ke", "To")} {sashName(progress.target.level, lang)}</strong>
              <span className="font-extrabold">{progress.itemsDone} / {progress.itemsTotal}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-hairline" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[13px] text-muted">
              {t("Kehadiran", "Attendance")} {progress.classesSince} / {progress.target.minClasses}
              {grading ? ` · ${t("gred seterusnya", "next grading")} ${dateLabel(grading.day, lang, { weekday: false })}` : ""}
            </span>
          </>
        ) : (
          <strong className="text-[15px]">{t("Bengkung Hitam. Masya-Allah!", "Black sash. Masya-Allah!")}</strong>
        )}
      </Link>

      <div className="grid grid-cols-2 gap-2.5">
        <Link href={`/library?level=${progress.target ? progress.target.level : m.level}`} className="flex flex-col gap-1 rounded-[14px] bg-surface p-3.5 text-ink">
          <strong className="text-[15px]">{t("Latihan saya", "My practice")}</strong>
          <span className="text-[13px] text-muted">{t("Video untuk tahap seterusnya", "Videos for the next level")}</span>
        </Link>
        <Link href="/grading" className="flex flex-col gap-1 rounded-[14px] bg-surface p-3.5 text-ink">
          <strong className="text-[15px]">{t("Gred & sijil", "Grading & certificates")}</strong>
          <span className="text-[13px] text-muted">{sashName(m.level, lang)}</span>
        </Link>
      </div>

      {news[0] ? (
        <Link href="/news" className="flex flex-col gap-1 rounded-[14px] bg-accent-soft p-4 text-ink">
          <strong className="text-[14px]">{news[0].title}</strong>
          <span className="line-clamp-2 text-[13px] leading-relaxed">{news[0].body}</span>
        </Link>
      ) : null}

      <StaffLinks user={user} t={t} />

      <div className="flex justify-center gap-5 text-[14px] font-bold">
        <Link href="/register" className="text-accent-press">+ {t("Ahli keluarga", "Family member")}</Link>
        <Link href="/profile" className="text-accent-press">{t("Profil & tetapan", "Profile & settings")}</Link>
      </div>
    </div>
  );
}

function StaffLinks({ user, t }) {
  if (!isInstructor(user)) return null;
  return (
    <div className="flex flex-col gap-2">
      <Link href="/instructor" className="flex items-center justify-between rounded-[14px] bg-ink p-4 font-extrabold text-page">
        {t("Mod jurulatih", "Instructor mode")}
        <Icon name="chevron-right" size={20} />
      </Link>
      {isAdmin(user) ? (
        <Link href="/admin" className="btn btn-line">{t("Panel admin", "Admin panel")}</Link>
      ) : null}
    </div>
  );
}
