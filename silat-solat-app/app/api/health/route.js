export const dynamic = "force-dynamic";

/** Railway's health check: the server is up. The database is optional. */
export function GET() {
  return Response.json({ ok: true });
}
