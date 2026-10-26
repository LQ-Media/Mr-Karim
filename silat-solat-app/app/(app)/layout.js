import { getUser } from "@/lib/auth";
import { getLang } from "@/lib/i18n";
import TopBar from "@/components/TopBar";
import BottomTabs from "@/components/BottomTabs";
import ProgressSync from "@/components/progress/ProgressSync";

export default async function AppLayout({ children }) {
  const [user, lang] = await Promise.all([getUser(), getLang()]);
  return (
    <div className="min-h-dvh">
      <ProgressSync signedIn={Boolean(user)} />
      <TopBar lang={lang} user={user} />
      <main className="mx-auto w-full max-w-[860px] px-5 pb-28 lg:px-10 lg:pb-16">{children}</main>
      <BottomTabs lang={lang} />
    </div>
  );
}
