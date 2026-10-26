import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { googleConfigured, safeNext } from "@/lib/oauth";
import { getT } from "@/lib/i18n";
import { PadiMark } from "@/components/Logo";

export const metadata = { title: "Log masuk" };

export default async function SignIn({ searchParams }) {
  const { next, error } = await searchParams;
  const dest = safeNext(next || "/me");
  if (await getUser()) redirect(dest);
  const t = await getT();
  const on = googleConfigured();
  const errors = {
    cancelled: t("Log masuk dibatalkan. Cuba lagi bila-bila masa.", "Sign-in was cancelled. Try again any time."),
    state: t("Pautan log masuk tamat tempoh. Cuba lagi.", "That sign-in link expired. Please try again."),
    failed: t("Log masuk Google tidak berjaya. Cuba lagi.", "Google sign-in didn't work. Please try again."),
    off: t("Log masuk belum dibuka. Laman awam masih boleh digunakan.", "Sign-in isn't switched on yet. The public pages still work."),
  };
  return (
    <div className="ss-rise -mx-5 flex min-h-[calc(100dvh-140px)] flex-col justify-between bg-ink px-6 py-8 text-page lg:mx-0 lg:mt-6 lg:rounded-[20px]">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <PadiMark size={110} />
        <h1 className="text-[40px]" style={{ color: "#F6F0E1" }}>
          Silat <span style={{ color: "#D9A521" }}>&amp;</span> Solat
        </h1>
        <p className="max-w-[300px] text-[16px] leading-relaxed text-[#DCD3BF]">
          {t(
            "Seperti padi, makin berisi makin tunduk. Log masuk untuk pendaftaran, kehadiran dan kemajuan bengkung.",
            "Like the padi, the fuller it grows the lower it bows. Sign in for registration, attendance and sash progress."
          )}
        </p>
      </div>
      <div className="mx-auto flex w-full max-w-[420px] flex-col gap-3">
        {error && errors[error] ? (
          <p role="alert" className="rounded-[12px] bg-accent-soft px-3 py-2 text-center text-[14px] text-ink">{errors[error]}</p>
        ) : null}
        {on ? (
          <a href={`/api/auth/google?next=${encodeURIComponent(dest)}`} className="btn bg-white text-[16px] text-[#1F1F1F]">
            <GoogleMark />
            {t("Teruskan dengan Google", "Continue with Google")}
          </a>
        ) : (
          <p className="rounded-[12px] bg-accent-soft px-3 py-2 text-center text-[14px] text-ink">{errors.off}</p>
        )}
        <p className="text-center text-[13px] leading-relaxed text-[#B8AE98]">
          {t("Ibu bapa log masuk untuk anak bawah 18 tahun. Lihat ", "Parents sign in for children under 18. See our ")}
          <a href="/privacy" className="underline" style={{ color: "#E9C766" }}>
            {t("notis privasi (PDPA)", "privacy notice (PDPA)")}
          </a>
          .
        </p>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.4 13.7 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z" />
      <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.6 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}
