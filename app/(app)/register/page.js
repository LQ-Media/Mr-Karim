import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { getMember, getFamily } from "@/lib/data";
import { PageTitle } from "@/components/Bits";
import MemberForm from "@/components/MemberForm";
import { removeMember } from "@/app/member-actions";

export const metadata = { title: "Pendaftaran" };

export default async function Register({ searchParams }) {
  const user = await requireUser("/register");
  const t = await getT();
  const sp = await searchParams;
  const member = sp?.id ? await getMember(sp.id) : null;
  const mine = member && member.account_id === user.id ? member : null;
  const family = await getFamily(user.id);
  return (
    <div className="ss-rise">
      <PageTitle
        kicker={mine ? t("Kemas kini", "Edit") : t("Pendaftaran keluarga", "Family registration")}
        title={mine ? mine.display_name : family.length ? t("Tambah ahli keluarga", "Add a family member") : t("Siapa yang akan berlatih?", "Who will train?")}
      >
        {!mine ? t("Satu akaun untuk seluruh keluarga. Kanak-kanak tidak memerlukan log masuk sendiri.", "One account for the whole family. Children don't need a login of their own.") : null}
      </PageTitle>
      <MemberForm lang={t.lang} member={mine} accountName={family.length ? "" : user.name} />
      {mine ? (
        <form action={removeMember} className="mt-6">
          <input type="hidden" name="id" value={mine.id} />
          <button className="text-[14px] font-bold text-danger-fg">{t("Buang profil ini", "Remove this profile")}</button>
        </form>
      ) : null}
    </div>
  );
}
