/**
 * Mr Karim — Cloudflare Worker entrypoint.
 *
 * Cron polls Gmail, stores anything new, then classifies whatever is not yet
 * classified. Drafting and the dashboard land next.
 */

import Anthropic from "@anthropic-ai/sdk";
import defaultRules from "../settings/rules.md";
import * as gmail from "./gmail.ts";
import {
  getState,
  insertMessage,
  insertTriage,
  loadRules,
  setState,
  untriagedMessages,
} from "./db.ts";
import { TRIAGE_MODEL, buildSystemPrompt, triage } from "./triage.ts";
import type { Env } from "./types.ts";

// Overlaps the 5-minute cron generously; duplicates are dropped on insert.
const POLL_WINDOW_SECONDS = 15 * 60;

const notYet = (what: string) =>
  new Response(`${what} is not implemented yet\n`, { status: 501 });

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === "/health") {
      try {
        const counts = await env.DB.prepare(
          `SELECT
             (SELECT COUNT(*) FROM messages) AS messages,
             (SELECT COUNT(*) FROM triage)   AS triaged,
             (SELECT COUNT(*) FROM bills WHERE status = 'open') AS open_bills`,
        ).first<{ messages: number; triaged: number; open_bills: number }>();
        return Response.json({ ok: true, db: "connected", ...counts });
      } catch (err) {
        return Response.json(
          { ok: false, db: "unreachable", error: String(err) },
          { status: 503 },
        );
      }
    }

    // Runs the same work as cron, for checking setup without waiting.
    if (pathname === "/admin/poll" && request.method === "POST") {
      if (!isBridgeAuthorised(request, env)) {
        return new Response("unauthorised\n", { status: 401 });
      }
      const report = await runCycle(env);
      return Response.json(report);
    }

    if (pathname === "/webhook/whatsapp") {
      if (request.method === "GET") return verifyMetaWebhook(url, env);
      if (request.method === "POST") return notYet("WhatsApp ingest");
    }

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

  async scheduled(event: ScheduledController, env: Env): Promise<void> {
    const report = await runCycle(env);
    console.log(`cron ${event.cron}`, JSON.stringify(report));
  },
};

interface CycleReport {
  fetched: number;
  stored: number;
  triaged: number;
  errors: string[];
}

/** Poll every configured inbox, then classify whatever is still unclassified. */
async function runCycle(env: Env): Promise<CycleReport> {
  const report: CycleReport = { fetched: 0, stored: 0, triaged: 0, errors: [] };

  const inboxes = [
    { account: "work", refresh: env.GMAIL_REFRESH_TOKEN_WORK },
    { account: "personal", refresh: env.GMAIL_REFRESH_TOKEN_PERSONAL },
    // An unset refresh token means that inbox is not connected yet; the work
    // account polls fine on its own while the personal one is pending.
  ].filter((inbox) => Boolean(inbox.refresh));

  for (const inbox of inboxes) {
    try {
      const token = await gmail.accessToken(
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET,
        inbox.refresh,
      );
      const ids = await gmail.listRecent(token, POLL_WINDOW_SECONDS);
      report.fetched += ids.length;

      for (const id of ids) {
        try {
          const message = await gmail.fetchMessage(token, inbox.account, id);
          if (await insertMessage(env.DB, message)) report.stored++;
        } catch (err) {
          report.errors.push(`gmail ${inbox.account} ${id}: ${err}`);
        }
      }
      await setState(env.DB, `gmail:${inbox.account}:last_poll`, String(Date.now()));
    } catch (err) {
      report.errors.push(`gmail ${inbox.account}: ${err}`);
    }
  }

  const pending = await untriagedMessages(env.DB);
  if (pending.length > 0) {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const systemPrompt = buildSystemPrompt(
      await loadRules(env.DB, defaultRules),
    );

    for (const message of pending) {
      try {
        const { result } = await triage(client, systemPrompt, message);
        await insertTriage(env.DB, message.id, result, TRIAGE_MODEL);
        report.triaged++;
      } catch (err) {
        report.errors.push(`triage ${message.id}: ${err}`);
      }
    }
  }

  return report;
}

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

/**
 * Constant-time comparison so the shared secret can't be timing-guessed.
 *
 * The empty case has to be rejected explicitly: with no secret configured,
 * expected and presented are both zero-length, the loop never runs, and a
 * plain `diff === 0` would authorise every caller. A missing secret must
 * close the endpoint, not open it.
 */
const MIN_SECRET_LENGTH = 16;

function isBridgeAuthorised(request: Request, env: Env): boolean {
  const expected = env.BRIDGE_SHARED_SECRET ?? "";
  if (expected.length < MIN_SECRET_LENGTH) return false;

  const presented = request.headers.get("x-bridge-secret") ?? "";
  if (presented.length !== expected.length) return false;

  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= presented.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
