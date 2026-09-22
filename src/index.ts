/**
 * Mr Karim — Cloudflare Worker entrypoint.
 *
 * Routing only at this stage. Ingest, triage and drafting land next; each
 * handler below says what it will do and returns 501 until it does it.
 */

export interface Env {
  DB: D1Database;
  ANTHROPIC_API_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  WHATSAPP_ACCESS_TOKEN: string;
  WHATSAPP_VERIFY_TOKEN: string;
  BRIDGE_SHARED_SECRET: string;
}

const notYet = (what: string) =>
  new Response(`${what} is not implemented yet\n`, { status: 501 });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === "/health") {
      // Confirms the Worker is up and the D1 binding actually resolves.
      try {
        await env.DB.prepare("SELECT 1").first();
        return Response.json({ ok: true, db: "connected" });
      } catch (err) {
        return Response.json(
          { ok: false, db: "unreachable", error: String(err) },
          { status: 503 },
        );
      }
    }

    // Meta calls this once with a challenge to prove we own the endpoint,
    // then POSTs every inbound message here.
    if (pathname === "/webhook/whatsapp") {
      if (request.method === "GET") return verifyMetaWebhook(url, env);
      if (request.method === "POST") return notYet("WhatsApp ingest");
    }

    // Gmail push via Pub/Sub. Carries a historyId, not the message itself —
    // the handler will fetch changes since our stored cursor.
    if (pathname === "/webhook/gmail" && request.method === "POST") {
      return notYet("Gmail ingest");
    }

    // The Mac Studio bridge posts personal WhatsApp messages here.
    if (pathname === "/bridge/ingest" && request.method === "POST") {
      if (!isBridgeAuthorised(request, env)) {
        return new Response("unauthorised\n", { status: 401 });
      }
      return notYet("Bridge ingest");
    }

    if (pathname === "/" || pathname.startsWith("/app")) {
      return notYet("Dashboard");
    }

    return new Response("not found\n", { status: 404 });
  },

  async scheduled(event: ScheduledController, _env: Env): Promise<void> {
    // 0 1 * * *   — bill reminders (5 days out, then 1 day out)
    // *\/30 * * * * — sweep for anything the webhooks dropped
    console.log("scheduled run", event.cron);
  },
};

/** Meta's subscription handshake: echo hub.challenge if the token matches. */
function verifyMetaWebhook(url: URL, env: Env): Response {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("verification failed\n", { status: 403 });
}

/** Constant-time comparison so the shared secret can't be timing-guessed. */
function isBridgeAuthorised(request: Request, env: Env): boolean {
  const presented = request.headers.get("x-bridge-secret") ?? "";
  const expected = env.BRIDGE_SHARED_SECRET ?? "";
  if (presented.length !== expected.length) return false;

  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= presented.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
