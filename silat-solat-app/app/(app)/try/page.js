import { PageTitle } from "@/components/Bits";
import { getT } from "@/lib/i18n";
import { getClasses } from "@/lib/data";
import { nowInSgt } from "@/lib/time";
import TryForm from "./TryForm";

export const metadata = { title: "Cuba kelas" };

export default async function Try({ searchParams }) {
  const t = await getT();
  const sp = await searchParams;
  const classes = await getClasses();
  const now = nowInSgt();
  return (
    <div className="ss-rise">
      <PageTitle kicker={t("Percuma", "Free")} title={t("Cuba satu kelas", "Try a class")}>
        {t("Tiada log masuk diperlukan. Jurulatih akan menunggu anda.", "No sign-in needed. The instructor will expect you.")}
      </PageTitle>
      <TryForm classes={classes} lang={t.lang} today={{ date: now.dateISO, weekday: now.weekday }} initialBranch={sp?.branch} />
    </div>
  );
}
