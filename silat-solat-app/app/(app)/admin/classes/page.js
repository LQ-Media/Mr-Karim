import { getT } from "@/lib/i18n";
import { getClasses } from "@/lib/data";
import { BRANCHES, BY_SLUG, STREAMS } from "@/lib/branches";
import { DAYS } from "@/lib/tr";
import { saveClass, toggleClassActive } from "@/app/admin-actions";
import { BranchDot } from "@/components/Bits";

export const metadata = { title: "Admin · Kelas" };

function ClassFields({ c, lang, t }) {
  return (
    <>
      {c ? <input type="hidden" name="id" value={c.id} /> : null}
      <select name="branch" defaultValue={c?.branch || "an-nur"} aria-label={t("Cawangan", "Branch")} className="input text-[14px]">
        {BRANCHES.map((b) => <option key={b.slug} value={b.slug}>{b.short}</option>)}
      </select>
      <select name="stream" defaultValue={c?.stream || "adults"} aria-label={t("Aliran", "Stream")} className="input text-[14px]">
        {Object.entries(STREAMS).map(([k, v]) => <option key={k} value={k}>{v[lang]}</option>)}
      </select>
      <select name="weekday" defaultValue={c?.weekday ?? 5} aria-label={t("Hari", "Day")} className="input text-[14px]">
        {DAYS[lang].map((d, i) => <option key={i} value={i}>{d}</option>)}
      </select>
      <input type="time" name="starts" defaultValue={c?.starts || "20:00"} aria-label={t("Mula", "Starts")} className="input text-[14px]" />
      <input type="time" name="ends" defaultValue={c?.ends || "22:00"} aria-label={t("Tamat", "Ends")} className="input text-[14px]" />
      <label className="flex items-center gap-2 text-[13px] font-bold">
        <input type="checkbox" name="confirmed" defaultChecked={c?.confirmed} className="h-5 w-5 accent-[#17140F]" />
        {t("Disahkan", "Confirmed")}
      </label>
    </>
  );
}

export default async function AdminClasses() {
  const t = await getT();
  const lang = t.lang;
  const classes = (await getClasses({ includeInactive: true })).sort((a, b) => a.branch.localeCompare(b.branch) || a.weekday - b.weekday);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[30px]">{t("Kelas", "Classes")}</h1>
      <p className="text-[14px] text-muted">{t("Tandakan “Disahkan” selepas Ustaz mengesahkan masa. Masa yang belum disahkan dipaparkan dengan amaran.", "Tick “Confirmed” once the Ustaz confirms a time. Unconfirmed times show a warning.")}</p>
      {classes.map((c) => (
        <div key={c.id} className="flex flex-col gap-2 rounded-[14px] bg-surface p-3" style={{ opacity: c.active ? 1 : 0.55 }}>
          <div className="flex items-center gap-2 text-[14px] font-extrabold">
            <BranchDot slug={c.branch} /> {BY_SLUG[c.branch].short} · {STREAMS[c.stream][lang]}
            {!c.active ? <span className="chip">{t("Tidak aktif", "Inactive")}</span> : null}
          </div>
          <form action={saveClass} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-7">
            <ClassFields c={c} lang={lang} t={t} />
            <button className="btn btn-ink btn-sm">{t("Simpan", "Save")}</button>
          </form>
          <form action={toggleClassActive}>
            <input type="hidden" name="id" value={c.id} />
            <button className="text-[13px] font-bold text-accent-press">{c.active ? t("Nyahaktifkan", "Deactivate") : t("Aktifkan", "Activate")}</button>
          </form>
        </div>
      ))}
      <h2 className="text-[20px]">{t("Tambah kelas", "Add a class")}</h2>
      <form action={saveClass} className="grid grid-cols-2 items-center gap-2 rounded-[14px] bg-surface p-3 sm:grid-cols-7">
        <ClassFields lang={lang} t={t} />
        <button className="btn btn-gold btn-sm">{t("Tambah", "Add")}</button>
      </form>
    </div>
  );
}
