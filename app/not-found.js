import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-page p-6 text-center">
      <h1 className="text-[32px]">Tidak dijumpai · Not found</h1>
      <Link href="/" className="btn btn-ink">Utama · Home</Link>
    </div>
  );
}
