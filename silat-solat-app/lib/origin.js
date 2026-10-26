import "server-only";
import { headers } from "next/headers";

/** This site's public address: APP_ORIGIN, else the host Railway forwarded. */
export async function siteOrigin() {
  const configured = String(process.env.APP_ORIGIN || "").trim();
  if (configured) return configured.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = (h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https")).split(",")[0].trim();
  return `${proto}://${host}`;
}
