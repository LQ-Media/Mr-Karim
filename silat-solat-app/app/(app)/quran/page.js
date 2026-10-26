import QuranReader from "@/components/quran/QuranReader";
import LogActivity from "@/components/progress/LogActivity";

export const metadata = { title: "Al-Quran" };

export default function QuranPage() {
  // Full-bleed: the reader sizes itself to end above the bottom tab bar.
  return (
    <div className="-mx-5 -mb-28 lg:-mx-10 lg:-mb-16">
      <LogActivity kind="quran" />
      <QuranReader />
    </div>
  );
}
