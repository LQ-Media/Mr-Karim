import { PageTitle, Notice } from "@/components/Bits";
import { getT } from "@/lib/i18n";
import { dbConfigured, query } from "@/lib/db";
import { FAQ, faqApproved } from "@/lib/faq";
import AskForm from "./AskForm";

export const metadata = { title: "Tanya Ustaz Silat" };

async function publishedQuestions(lang) {
  if (dbConfigured()) {
    const { rows } = await query(
      "select id::text, question, question_en, answer_ms, answer_en from questions where published order by sort, created_at"
    );
    if (rows.length) {
      return rows.map((r) => ({
        id: r.id,
        q: lang === "en" ? r.question_en || r.question : r.question,
        a: lang === "en" ? r.answer_en || r.answer_ms : r.answer_ms || r.answer_en,
      }));
    }
  }
  if (!faqApproved()) return [];
  const i = lang === "en" ? 1 : 0;
  return FAQ.map((f, n) => ({ id: String(n), q: f.q[i], a: f.a[i] }));
}

export default async function Ask() {
  const t = await getT();
  const items = await publishedQuestions(t.lang);
  return (
    <div className="ss-rise flex flex-col gap-4">
      <PageTitle kicker={t("Soalan lazim", "Common questions")} title={t("Tanya Ustaz Silat", "Ask Ustaz Silat")}>
        {t("Dijawab dan disemak oleh Ustaz.", "Answered and checked by the Ustaz.")}
      </PageTitle>
      {items.length === 0 ? (
        <Notice>{t("Jawapan pertama sedang disemak oleh Ustaz. Hantar soalan anda di bawah.", "The first answers are being checked by the Ustaz. Send your question below.")}</Notice>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((x, i) => (
            <details key={x.id} open={i === 0} className="group rounded-[14px] bg-surface">
              <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 p-4 text-[15px] font-extrabold">
                {x.q}
                <span aria-hidden="true" className="text-[20px] group-open:rotate-45">+</span>
              </summary>
              <p className="px-4 pb-4 text-[14px] leading-relaxed text-[#3E372D]">{x.a}</p>
            </details>
          ))}
        </div>
      )}
      <AskForm lang={t.lang} />
    </div>
  );
}
