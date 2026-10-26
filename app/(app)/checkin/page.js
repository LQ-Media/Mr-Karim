import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { getClass, getFamily, todaySgt } from "@/lib/data";
import { checkinValid } from "@/lib/checkin";
import { BY_SLUG, STREAMS } from "@/lib/branches";
import { DAYS, clock } from "@/lib/tr";
import CheckInForm from "./CheckInForm";

export const metadata = { title: "Daftar hadir" };

/** Where a class QR code lands. The phone camera opens it; we do the rest. */
export default async function CheckIn({ searchParams }) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ c: sp?.c || "", d: sp?.d || "", s: sp?.s || "" }).toString();
  const user = await requireUser(`/checkin?${qs}`);
  const t = await getT();
  const valid = checkinValid(sp?.c, sp?.d, sp?.s);
  const cls = valid ? await getClass(sp.c) : null;
  const family = await getFamily(user.id);
  const isToday = sp?.d === todaySgt();

  return (
    <div className="-mx-5 flex min-h-[calc(100dvh-140px)] flex-col items-center justify-center gap-5 bg-[#0E0C09] px-6 py-8 text-page lg:mx-0 lg:mt-5 lg:rounded-[20px]">
      <h1 className="text-[26px]" style={{ color: "#F6F0E1" }}>{t("Daftar hadir", "Check in")}</h1>
      {!cls ? (
        <p className="text-center">{t("Kod QR ini tidak sah. Minta jurulatih tunjukkan kod hari ini.", "This QR code isn't valid. Ask the instructor to show today's code.")}</p>
      ) : !isToday ? (
        <p className="text-center">{t("Kod QR ini untuk hari lain. Minta kod hari ini daripada jurulatih.", "This QR code is for another day. Ask the instructor for today's.")}</p>
      ) : !family.length ? (
        <>
          <p className="text-center">{t("Daftar profil latihan dahulu.", "Register a training profile first.")}</p>
          <Link href="/register" className="btn btn-gold">{t("Daftar", "Register")}</Link>
        </>
      ) : (
        <>
          <p className="text-center text-[15px] text-[#DCD3BF]">
            {BY_SLUG[cls.branch].name} · {STREAMS[cls.stream][t.lang]}
            <br />
            {DAYS[t.lang][cls.weekday]} {clock(cls.starts, t.lang)}
          </p>
          <CheckInForm
            lang={t.lang}
            c={sp.c}
            d={sp.d}
            s={sp.s}
            members={family.map((m) => ({ id: m.id, display_name: m.display_name, match: m.branch === cls.branch && m.stream === cls.stream }))}
          />
        </>
      )}
    </div>
  );
}
