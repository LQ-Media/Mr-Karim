import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { getFamily, announcementsFor } from "@/lib/data";
import { BY_SLUG, STREAMS } from "@/lib/branches";
import { PageTitle, Empty } from "@/components/Bits";
import { dateLabel } from "@/lib/tr";

export const metadata = { title: "Pengumuman" };

export default async function News() {
  const user = await requireUser("/news");
  const t = await getT();
  const family = await getFamily(user.id);
  const items = await announcementsFor(family, 40);
  return (
    <div className="ss-rise flex flex-col gap-2.5">
      <PageTitle title={t("Pengumuman", "Announcements")} />
      {items.length === 0 ? <Empty>{t("Tiada pengumuman lagi.", "No announcements yet.")}</Empty> : null}
      {items.map((a) => (
        <article key={a.id} className="flex flex-col gap-1.5 rounded-[14px] bg-surface p-4" style={a.branch ? { boxShadow: `inset 0 3px 0 ${BY_SLUG[a.branch]?.color === "#FFFFFF" ? "#E2D8C2" : BY_SLUG[a.branch]?.color}` } : undefined}>
          <div className="flex justify-between gap-2 text-[12px] font-extrabold text-muted">
            <span>
              {a.branch ? BY_SLUG[a.branch]?.short : t("Semua cawangan", "All branches")}
              {a.stream ? ` · ${STREAMS[a.stream]?.[t.lang]}` : ""}
            </span>
            <span>{dateLabel(a.at, t.lang)}</span>
          </div>
          <strong className="text-[16px]">{a.title}</strong>
          <p className="whitespace-pre-line text-[14px] leading-relaxed text-[#3E372D]">{a.body}</p>
        </article>
      ))}
    </div>
  );
}
