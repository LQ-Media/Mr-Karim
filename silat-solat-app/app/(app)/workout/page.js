import { getT } from "@/lib/i18n";
import Timer from "./Timer";

export const metadata = { title: "Senaman Tabata" };

export default async function Workout() {
  const t = await getT();
  return (
    <div>
      <h1 className="sr-only">{t("Senaman Tabata lepas Subuh", "Post-Subuh Tabata workout")}</h1>
      <Timer lang={t.lang} />
    </div>
  );
}
