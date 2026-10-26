import PayForm from "@/components/PayForm";
import { PageTitle, Empty } from "@/components/Bits";
import { getT } from "@/lib/i18n";
import { dbConfigured, query } from "@/lib/db";
import { sgd } from "@/lib/money";
import { stripeConfigured } from "@/lib/stripe";
import { paynowAccount } from "@/lib/paynow";
import Volunteer from "./Volunteer";

export const metadata = { title: "Kempen" };

async function getCampaigns() {
  if (!dbConfigured()) return [];
  const { rows } = await query(
    `select c.*, coalesce((select sum(amount_cents) from payments p where p.campaign_id = c.id and p.status = 'paid'), 0)::int as raised
     from campaigns c where status <> 'closed' order by status, created_at`
  );
  return rows;
}

export default async function Campaigns() {
  const t = await getT();
  const lang = t.lang;
  const list = await getCampaigns();
  const card = stripeConfigured();
  const paynow = Boolean(paynowAccount());
  return (
    <div className="ss-rise flex flex-col gap-4">
      <PageTitle kicker={t("Amal", "Giving")} title={t("Kempen komuniti", "Community campaigns")}>
        {t("Wang kempen dilaporkan berasingan mengikut setiap kempen.", "Campaign money is reported separately for each campaign.")}
      </PageTitle>
      {list.length === 0 ? <Empty>{t("Tiada kempen buat masa ini.", "No campaigns right now.")}</Empty> : null}
      {list.map((c) => {
        const pct = c.goal_cents ? Math.min(100, Math.round((c.raised / c.goal_cents) * 100)) : null;
        return (
          <article key={c.id} className="card flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-[21px]">{lang === "en" ? c.title_en : c.title_ms}</h2>
              <span className="chip shrink-0">{c.status === "active" ? t("Sedang berjalan", "Running") : t("Akan datang", "Coming up")}</span>
            </div>
            <p className="text-[14px] leading-relaxed text-[#3E372D]">{lang === "en" ? c.body_en : c.body_ms}</p>
            {c.status === "active" ? (
              <>
                {pct !== null ? (
                  <div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-hairline" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-1 flex justify-between text-[13px] font-bold">
                      <span>{sgd(c.raised)}</span>
                      <span className="text-muted">{t("sasaran", "goal")} {sgd(c.goal_cents)}</span>
                    </div>
                  </div>
                ) : c.raised ? (
                  <p className="text-[13px] font-bold">{sgd(c.raised)} {t("terkumpul", "raised")}</p>
                ) : null}
                <PayForm lang={lang} purpose="campaign" card={card} paynow={paynow} hidden={{ campaign: c.slug }}>
                  <label className="field">
                    {t("Jumlah (S$)", "Amount (S$)")}
                    <input name="amount" type="number" min="1" max="5000" step="1" defaultValue="20" inputMode="numeric" className="input" />
                  </label>
                </PayForm>
              </>
            ) : null}
            {c.volunteers ? <Volunteer lang={lang} slug={c.slug} /> : null}
          </article>
        );
      })}
    </div>
  );
}
