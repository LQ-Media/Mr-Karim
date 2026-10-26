import Link from "next/link";
import { getT } from "@/lib/i18n";
import { PadiMark } from "@/components/Logo";
import { BranchDot } from "@/components/Bits";
import { BRANCHES } from "@/lib/branches";
import { LINKS, USTAZ_NAME } from "@/lib/brand";

export const metadata = { title: "Kisah kami" };

export default async function Story() {
  const t = await getT();
  return (
    <div className="ss-rise flex flex-col gap-4 pt-5">
      <section className="relative overflow-hidden rounded-[20px] bg-ink p-6 text-page">
        <span className="absolute -right-3 top-3 opacity-90">
          <PadiMark size={130} />
        </span>
        <p className="kicker" style={{ color: "#D9A521" }}>{t("Kisah kami", "Our story")}</p>
        <h1 className="mt-2 max-w-[260px] text-[32px] leading-[1.08]" style={{ color: "#F6F0E1" }}>
          {t("Makin berisi, makin tunduk", "The fuller it grows, the lower it bows")}
        </h1>
      </section>
      <p className="text-[16px] leading-relaxed">
        {t(
          "“Rumpun” bermaksud serumpun, sekelompok. “Padi” ialah pesilat yang kami harapkan: semakin banyak ilmunya, semakin rendah hatinya.",
          "“Rumpun” means a cluster, a collective. “Padi” is rice: the student we hope you become, humbler the more you know."
        )}
      </p>
      <div className="card flex flex-col gap-2 p-4">
        <h2 className="text-[19px]">{t("Silat sebagai dakwah", "Silat as dakwah")}</h2>
        <p className="text-[14px] leading-relaxed text-muted">
          {t(
            `${USTAZ_NAME} berhujah sejak 2007 bahawa silat bukan syirik atau khurafat, tetapi wasilah untuk mendekatkan anak muda kepada masjid. Latih tubuh di masjid, kemudian berdiri bersama untuk solat.`,
            `${USTAZ_NAME} has argued since 2007 that silat is not syirik or superstition but a way to bring young people to the mosque. Train the body in the mosque, then stand together for solat.`
          )}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="card flex flex-col gap-1 p-4">
          <span className="kicker text-muted">{t("Senjata khas", "Signature weapon")}</span>
          <strong className="font-heading text-[22px]">Tekpi</strong>
        </div>
        <div className="card flex flex-col gap-1 p-4">
          <span className="kicker text-muted">{t("Ahli gabungan", "Affiliate of")}</span>
          <a href={LINKS.persisi} target="_blank" rel="noopener noreferrer" className="font-heading text-[22px] text-ink">PERSISI</a>
        </div>
      </div>
      <div className="card flex flex-col gap-2 p-4">
        <h2 className="text-[19px]">{t("Warisan Singapura", "Singapore heritage")}</h2>
        <p className="text-[14px] leading-relaxed text-muted">
          {t(
            "Silat diiktiraf sebagai warisan budaya tidak ketara. Lembaga Warisan Negara mendokumentasikan Si Rumpun Padi dalam kajiannya tentang kumpulan silat Singapura.",
            "Silat is recognised as intangible cultural heritage. The National Heritage Board documents Si Rumpun Padi in its study of Singapore silat groups."
          )}
        </p>
        <a href={LINKS.roots} target="_blank" rel="noopener noreferrer" className="text-[14px] font-extrabold text-accent-press">
          {t("Baca di Roots.gov.sg", "Read it on Roots.gov.sg")}
        </a>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
        {BRANCHES.map((b) => (
          <Link key={b.slug} href={`/branches/${b.slug}`} aria-label={b.name}>
            <BranchDot slug={b.slug} size={14} />
          </Link>
        ))}
        <span className="ml-1">{t("Lima masjid, satu keluarga", "Five mosques, one family")}</span>
      </div>
      <div className="flex gap-3 text-[14px] font-bold">
        <a href={LINKS.facebook} target="_blank" rel="noopener noreferrer" className="text-accent-press">Facebook</a>
        <a href={LINKS.instagram} target="_blank" rel="noopener noreferrer" className="text-accent-press">Instagram</a>
      </div>
    </div>
  );
}
