import PayForm from "@/components/PayForm";
import { getT } from "@/lib/i18n";
import { BOOK } from "@/lib/book";
import { sgd } from "@/lib/money";
import { BRANCHES } from "@/lib/branches";
import { stripeConfigured } from "@/lib/stripe";
import { paynowAccount } from "@/lib/paynow";
import { getUser } from "@/lib/auth";

export const metadata = { title: "Buku Silat & Solat" };

export default async function Shop() {
  const t = await getT();
  const lang = t.lang;
  const user = await getUser();
  return (
    <div className="ss-rise flex flex-col gap-5 pt-5">
      <div className="flex items-end gap-4">
        <div className="flex h-[196px] w-[140px] shrink-0 flex-col justify-between rounded-[6px] border-l-[12px] border-gold bg-ink p-3.5 text-page">
          <span className="kicker" style={{ color: "#D9A521" }}>Buku</span>
          <span className="font-heading text-[26px] font-bold leading-none">
            Silat
            <br />
            <span style={{ color: "#D9A521" }}>&amp;</span>
            <br />
            Solat
          </span>
          <span className="text-[10px] text-[#DCD3BF]">{BOOK.author}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] leading-tight">{BOOK.title}</h1>
          <span className="text-[14px] text-muted">{BOOK.author}</span>
          <span className="text-[13px] text-muted">{BOOK.format[lang]}</span>
          <strong className="font-heading text-[28px]">{sgd(BOOK.priceCents)}</strong>
        </div>
      </div>
      <p className="text-[15px] leading-relaxed">{BOOK.blurb[lang]}</p>
      <PayForm lang={lang} purpose="book" card={stripeConfigured()} paynow={Boolean(paynowAccount())}>
        <label className="field">
          {t("Kuantiti", "Quantity")}
          <select name="qty" className="input" defaultValue="1">
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[15px] font-extrabold">{t("Cara terima", "Delivery")}</legend>
          <label className="flex items-center gap-2.5 rounded-[12px] bg-surface p-3 text-[15px]">
            <input type="radio" name="delivery" value="pickup" defaultChecked className="h-5 w-5 accent-[#17140F]" />
            <span className="flex-1">{t("Ambil di kelas", "Collect at class")}</span>
            <strong>{t("Percuma", "Free")}</strong>
          </label>
          <label className="flex items-center gap-2.5 rounded-[12px] bg-surface p-3 text-[15px]">
            <input type="radio" name="delivery" value="post" className="h-5 w-5 accent-[#17140F]" />
            <span className="flex-1">{t("Pos dalam Singapura", "Post within Singapore")}</span>
            <strong>{sgd(BOOK.postageCents)}</strong>
          </label>
        </fieldset>
        <label className="field">
          {t("Ambil di cawangan", "Collect at branch")}
          <select name="branch" className="input">
            {BRANCHES.map((b) => (
              <option key={b.slug} value={b.slug}>{b.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          {t("Alamat pos (jika dipos)", "Postal address (if posted)")}
          <textarea name="address" rows={2} className="input" autoComplete="street-address" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field">
            {t("Nama", "Name")}
            <input name="name" required defaultValue={user?.name || ""} className="input" autoComplete="name" />
          </label>
          <label className="field">
            {t("Telefon atau e-mel", "Phone or email")}
            <input name="contact" required defaultValue={user?.email || ""} className="input" />
          </label>
        </div>
      </PayForm>
    </div>
  );
}
