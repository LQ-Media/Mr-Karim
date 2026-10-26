import SolatWidget from "@/components/SolatWidget";
import { PageTitle } from "@/components/Bits";
import { getT } from "@/lib/i18n";
import { hijriToday } from "@/lib/hijri";
import Link from "next/link";

export const metadata = { title: "Waktu solat" };

export default async function Solat() {
  const t = await getT();
  return (
    <div className="ss-rise">
      <PageTitle kicker={hijriToday()} title={t("Waktu solat", "Prayer times")}>
        {t("Singapura secara asal, ikut kaedah MUIS. Tukar negara jika anda bermusafir.", "Singapore by default, by MUIS's method. Change country when travelling.")}
      </PageTitle>
      <SolatWidget />
      <Link href="/schedule" className="btn btn-line mt-5 w-full">
        {t("Lihat kelas dan solat berjemaah", "See classes and congregational prayers")}
      </Link>
    </div>
  );
}
