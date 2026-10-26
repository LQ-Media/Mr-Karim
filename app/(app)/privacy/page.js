import { PageTitle } from "@/components/Bits";
import { getT } from "@/lib/i18n";
import { CONTACT_EMAIL } from "@/lib/brand";

export const metadata = { title: "Privasi" };

export default async function Privacy() {
  const t = await getT();
  const items = [
    [t("Apa yang kami simpan", "What we keep"), t("Nama dan e-mel akaun Google anda; profil latihan yang anda daftarkan (nama, tahun lahir, cawangan, kelas, bengkung); kehadiran dan kemajuan sukatan; nota perubatan jika anda beri; rekod bayaran (tanpa butiran kad).", "Your Google account's name and email; the training profiles you register (name, birth year, branch, class, sash); attendance and syllabus progress; medical notes if you give them; payment records (never card details).")],
    [t("Siapa yang melihat", "Who sees it"), t("Jurulatih hanya melihat ahli di cawangan dan kelas mereka. Profil Muslimah hanya dilihat oleh jurulatih wanita dan admin. Nota perubatan hanya untuk jurulatih anda dan admin.", "Instructors see only the members in their own branch and class. Sisters' profiles are seen only by female instructors and admins. Medical notes are for your instructors and admins only.")],
    [t("Foto dan video", "Photos and videos"), t("Kami hanya menyiarkan rakaman seseorang jika kebenaran diberi semasa pendaftaran, dan tidak pernah memaparkan nama penuh kanak-kanak. Anda boleh tarik balik kebenaran di profil anda.", "We only publish footage of someone whose consent was given at registration, and never show children's full names. You can withdraw consent in your profile.")],
    [t("Bayaran", "Payments"), t("Kad diproses oleh Stripe; kami tidak melihat nombor kad. PayNow dibayar terus ke akaun bank Silat n Solat.", "Cards are processed by Stripe; we never see card numbers. PayNow goes straight to the Silat n Solat bank account.")],
    [t("Padam akaun", "Delete your account"), t("Di Profil › Padam akaun. Semua profil keluarga, kehadiran dan kemajuan dipadam. Rekod bayaran disimpan untuk akaun kewangan.", "In Profile › Delete account. Every family profile, attendance and progress record is deleted. Payment records are kept for the accounts.")],
  ];
  return (
    <div className="ss-rise flex flex-col gap-3">
      <PageTitle kicker="PDPA" title={t("Notis privasi", "Privacy notice")} />
      {items.map(([h, p]) => (
        <section key={h} className="card p-4">
          <h2 className="text-[18px]">{h}</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-muted">{p}</p>
        </section>
      ))}
      <p className="text-[14px] text-muted">
        {t("Soalan? E-mel ", "Questions? Email ")}
        <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold text-accent-press">{CONTACT_EMAIL}</a>
      </p>
    </div>
  );
}
