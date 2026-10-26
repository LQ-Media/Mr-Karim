import { getT } from "@/lib/i18n";
import { query } from "@/lib/db";
import { getVideos } from "@/lib/data";
import { BY_SLUG, STREAMS } from "@/lib/branches";
import { dateLabel } from "@/lib/tr";
import { sgd } from "@/lib/money";
import { deleteAnnouncement, toggleVideo, loadFaqDrafts, saveAnswer, deleteQuestion, saveCampaign } from "@/app/admin-actions";
import AnnounceForm from "@/components/AnnounceForm";
import VideoForm from "@/components/VideoForm";
import { Empty } from "@/components/Bits";

export const metadata = { title: "Admin · Kandungan" };

function CampaignFields({ c, t }) {
  return (
    <>
      {c ? <input type="hidden" name="id" value={c.id} /> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <input name="titleMs" required defaultValue={c?.title_ms} placeholder={t("Tajuk (BM)", "Title (Malay)")} aria-label={t("Tajuk (BM)", "Title (Malay)")} className="input" />
        <input name="titleEn" defaultValue={c?.title_en} placeholder={t("Tajuk (EN)", "Title (English)")} aria-label={t("Tajuk (EN)", "Title (English)")} className="input" />
        <textarea name="bodyMs" defaultValue={c?.body_ms} rows={2} placeholder={t("Keterangan (BM)", "Description (Malay)")} aria-label={t("Keterangan (BM)", "Description (Malay)")} className="input" />
        <textarea name="bodyEn" defaultValue={c?.body_en} rows={2} placeholder={t("Keterangan (EN)", "Description (English)")} aria-label={t("Keterangan (EN)", "Description (English)")} className="input" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[13px] font-bold">{t("Sasaran S$", "Goal S$")}<input name="goal" type="number" min="0" defaultValue={c?.goal_cents ? c.goal_cents / 100 : ""} className="input w-28" /></label>
        <select name="status" defaultValue={c?.status || "upcoming"} aria-label={t("Status", "Status")} className="input w-auto">
          <option value="active">{t("Sedang berjalan", "Running")}</option>
          <option value="upcoming">{t("Akan datang", "Coming up")}</option>
          <option value="closed">{t("Ditutup", "Closed")}</option>
        </select>
        <label className="flex items-center gap-1.5 text-[13px] font-bold"><input type="checkbox" name="volunteers" defaultChecked={c?.volunteers} className="h-5 w-5 accent-[#17140F]" />{t("Sukarelawan", "Volunteers")}</label>
      </div>
    </>
  );
}

export default async function Content() {
  const t = await getT();
  const lang = t.lang;
  const [news, videos, questions, campaigns] = await Promise.all([
    query("select id::text, branch, stream, title, at from announcements order by at desc limit 20"),
    getVideos({ all: true }),
    query("select *, id::text as id from questions order by published, sort, created_at desc"),
    query(
      `select c.*, c.id::text as id, coalesce((select sum(amount_cents) from payments p where p.campaign_id = c.id and p.status='paid'),0)::int as raised
       from campaigns c order by created_at`
    ),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[30px]">{t("Kandungan", "Content")}</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-[22px]">{t("Pengumuman", "Announcements")}</h2>
        <div className="card p-4"><AnnounceForm lang={lang} branches={Object.keys(BY_SLUG)} allowAll /></div>
        {news.rows.map((a) => (
          <form key={a.id} action={deleteAnnouncement} className="flex items-center gap-2 rounded-[12px] bg-surface p-3 text-[14px]">
            <input type="hidden" name="id" value={a.id} />
            <span className="flex-1"><strong>{a.title}</strong> · {a.branch ? BY_SLUG[a.branch]?.short : t("Semua", "All")}{a.stream ? ` · ${STREAMS[a.stream][lang]}` : ""} · {dateLabel(a.at, lang, { weekday: false })}</span>
            <button className="text-[13px] font-bold text-danger-fg">{t("Padam", "Delete")}</button>
          </form>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[22px]">{t("Perpustakaan video", "Video library")}</h2>
        <div className="card p-4"><VideoForm lang={lang} /></div>
        {videos.map((v) => (
          <div key={v.id} className="flex items-center gap-2 rounded-[12px] bg-surface p-3 text-[14px]" style={{ opacity: v.published ? 1 : 0.55 }}>
            <span className="flex-1"><strong>{lang === "en" ? v.title_en : v.title_ms}</strong> · {v.topic}</span>
            <form action={toggleVideo}><input type="hidden" name="id" value={v.id} /><button className="text-[13px] font-bold text-accent-press">{v.published ? t("Sorok", "Hide") : t("Siar", "Publish")}</button></form>
            <form action={toggleVideo}><input type="hidden" name="id" value={v.id} /><input type="hidden" name="delete" value="1" /><button className="text-[13px] font-bold text-danger-fg">{t("Padam", "Delete")}</button></form>
          </div>
        ))}
      </section>

      <section id="questions" className="flex flex-col gap-3">
        <h2 className="text-[22px]">Tanya Ustaz Silat</h2>
        <form action={loadFaqDrafts}>
          <button className="btn btn-line btn-sm">{t("Muat 10 draf jawapan untuk disemak", "Load the 10 draft answers to review")}</button>
        </form>
        {questions.rows.length === 0 ? <Empty>{t("Tiada soalan.", "No questions.")}</Empty> : null}
        {questions.rows.map((q) => (
          <details key={q.id} className="rounded-[14px] bg-surface" open={!q.published && !q.answer_ms}>
            <summary className="flex cursor-pointer items-center gap-2 p-3 text-[14px] font-extrabold">
              <span className="chip">{q.published ? t("Disiarkan", "Published") : q.answer_ms ? t("Draf", "Draft") : t("Baharu", "New")}</span>
              <span className="flex-1">{q.question}</span>
            </summary>
            <form action={saveAnswer} className="flex flex-col gap-2 px-3 pb-3">
              <input type="hidden" name="id" value={q.id} />
              {q.name || q.email ? <p className="text-[12px] text-muted">{q.name} {q.email}</p> : null}
              <textarea name="question" defaultValue={q.question} rows={2} aria-label={t("Soalan (BM)", "Question (Malay)")} className="input" />
              <textarea name="questionEn" defaultValue={q.question_en || ""} rows={2} placeholder={t("Soalan (EN)", "Question (English)")} aria-label={t("Soalan (EN)", "Question (English)")} className="input" />
              <textarea name="answerMs" defaultValue={q.answer_ms || ""} rows={4} placeholder={t("Jawapan (BM)", "Answer (Malay)")} aria-label={t("Jawapan (BM)", "Answer (Malay)")} className="input" />
              <textarea name="answerEn" defaultValue={q.answer_en || ""} rows={4} placeholder={t("Jawapan (EN)", "Answer (English)")} aria-label={t("Jawapan (EN)", "Answer (English)")} className="input" />
              <label className="flex items-center gap-2 text-[14px] font-bold"><input type="checkbox" name="published" defaultChecked={q.published} className="h-5 w-5 accent-[#17140F]" />{t("Siarkan (disemak oleh Ustaz)", "Publish (checked by the Ustaz)")}</label>
              <div className="flex gap-2">
                <button className="btn btn-ink btn-sm">{t("Simpan", "Save")}</button>
              </div>
            </form>
            <form action={deleteQuestion} className="px-3 pb-3"><input type="hidden" name="id" value={q.id} /><button className="text-[13px] font-bold text-danger-fg">{t("Padam soalan", "Delete question")}</button></form>
          </details>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[22px]">{t("Kempen", "Campaigns")}</h2>
        {campaigns.rows.map((c) => (
          <form key={c.id} action={saveCampaign} className="flex flex-col gap-2 rounded-[14px] bg-surface p-3">
            <p className="text-[13px] font-bold text-muted">{sgd(c.raised)} {t("terkumpul", "raised")}</p>
            <CampaignFields c={c} t={t} />
            <button className="btn btn-ink btn-sm self-start">{t("Simpan", "Save")}</button>
          </form>
        ))}
        <form action={saveCampaign} className="flex flex-col gap-2 rounded-[14px] border-2 border-dashed border-muted-3 p-3">
          <strong className="text-[15px]">{t("Kempen baharu", "New campaign")}</strong>
          <CampaignFields t={t} />
          <button className="btn btn-gold btn-sm self-start">{t("Tambah", "Add")}</button>
        </form>
      </section>
    </div>
  );
}
