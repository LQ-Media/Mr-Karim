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
import {
  renderDashboard,
  renderLocked,
  type LastRun,
  type QueueRow,
  type Totals,
} from "./dashboard.ts";

// Overlaps the 5-minute cron generously; duplicates are dropped on insert.
const POLL_WINDOW_SECONDS = 15 * 60;

// A manual poll may reach further back, to pull a real sample worth judging
// rather than waiting for mail to arrive. Capped at a week so a stray value
// cannot trigger an enormous backfill.
const MAX_MANUAL_WINDOW_SECONDS = 7 * 24 * 60 * 60;
const MAX_MANUAL_MESSAGES = 100;

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
    // ?minutes=N widens the lookback; ?max=N raises the per-inbox cap.
    if (pathname === "/admin/poll" && request.method === "POST") {
      if (!isBridgeAuthorised(request, env) && !isDashboardAuthorised(request, env)) {
        return new Response("unauthorised\n", { status: 401 });
      }
      const minutes = Number(url.searchParams.get("minutes"));
      const max = Number(url.searchParams.get("max"));
      const report = await runCycle(env, {
        windowSeconds: Number.isFinite(minutes) && minutes > 0
          ? Math.min(minutes * 60, MAX_MANUAL_WINDOW_SECONDS)
          : POLL_WINDOW_SECONDS,
        maxPerInbox: Number.isFinite(max) && max > 0
          ? Math.min(max, MAX_MANUAL_MESSAGES)
          : 25,
      });
      return Response.json(report);
    }

    // Describes the API key's shape without revealing it, and makes one live
    // call, so a 401 can be told apart from a malformed secret.
    if (pathname === "/admin/diag" && request.method === "POST") {
      if (!isBridgeAuthorised(request, env) && !isDashboardAuthorised(request, env)) {
        return new Response("unauthorised\n", { status: 401 });
      }
      const raw = env.ANTHROPIC_API_KEY ?? "";
      const key = raw.trim();
      const shape = {
        present: raw.length > 0,
        length: raw.length,
        length_after_trim: key.length,
        has_surrounding_whitespace: raw !== key,
        starts_with_sk_ant: key.startsWith("sk-ant-"),
        first_8: key.slice(0, 8),
        last_4: key.slice(-4),
      };

      let call: string;
      try {
        const client = new Anthropic({ apiKey: key });
        await client.messages.create({
          model: TRIAGE_MODEL,
          max_tokens: 4,
          messages: [{ role: "user", content: "hi" }],
        });
        call = "ok";
      } catch (err) {
        call = String(err).slice(0, 300);
      }

      return Response.json({ anthropic_key: shape, test_call: call });
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

    if (pathname === "/" || pathname === "/app") {
      const key = url.searchParams.get("k");
      // Arriving with ?k= sets the cookie and redirects, so the secret does
      // not linger in the address bar or get shared with a copied link.
      if (key && secretMatches(key, env)) {
        return new Response(null, {
          status: 302,
          headers: {
            location: "/",
            "set-cookie":
              `mk=${encodeURIComponent(key)}; HttpOnly; Secure; ` +
              `SameSite=Strict; Path=/; Max-Age=31536000`,
          },
        });
      }
      if (!isDashboardAuthorised(request, env)) {
        return new Response(renderLocked(), {
          status: 401,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }

      const [queue, totals, lastRun] = await Promise.all([
        env.DB.prepare(
          `SELECT m.id, m.source, m.sender, m.sender_name, m.subject,
                  m.received_at, t.category, t.urgency, t.needs_reply,
                  t.is_bill, t.summary, t.reasoning
             FROM triage t
             JOIN messages m ON m.id = t.message_id
            ORDER BY m.received_at DESC
            LIMIT 100`,
        ).all<QueueRow>(),
        env.DB.prepare(
          `SELECT
             (SELECT COUNT(*) FROM messages) AS messages,
             (SELECT COUNT(*) FROM triage)   AS triaged,
             (SELECT COUNT(*) FROM bills WHERE status = 'open') AS open_bills`,
        ).first<Totals>(),
        getState(env.DB, "last_run"),
      ]);

      return new Response(
        renderDashboard(
          queue.results ?? [],
          totals ?? { messages: 0, triaged: 0, open_bills: 0 },
          lastRun ? (JSON.parse(lastRun) as LastRun) : null,
        ),
        { headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }

    return new Response("not found\n", { status: 404 });
  },

  async scheduled(event: ScheduledController, env: Env): Promise<void> {
    const report = await runCycle(env);
    console.log(`cron ${event.cron}`, JSON.stringify(report));
  },
};

interface CycleReport {
  window_minutes: number;
  fetched: number;
  stored: number;
  triaged: number;
  errors: string[];
}

interface CycleOptions {
  windowSeconds: number;
  maxPerInbox: number;
}

/** Poll every configured inbox, then classify whatever is still unclassified. */
async function runCycle(
  env: Env,
  options: CycleOptions = {
    windowSeconds: POLL_WINDOW_SECONDS,
    maxPerInbox: 25,
  },
): Promise<CycleReport> {
  const report: CycleReport = {
    window_minutes: Math.round(options.windowSeconds / 60),
    fetched: 0,
    stored: 0,
    triaged: 0,
    errors: [],
  };

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
      const ids = await gmail.listRecent(
        token,
        options.windowSeconds,
        options.maxPerInbox,
      );
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

  const pending = await untriagedMessages(env.DB, options.maxPerInbox);
  if (pending.length > 0) {
    const client = new Anthropic({
      apiKey: (env.ANTHROPIC_API_KEY ?? "").trim(),
    });
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

  // A cron failure is otherwise invisible: console.log reaches nobody who is
  // not watching `wrangler tail`. Persisting the report puts it on the
  // dashboard, where it will actually be seen.
  await setState(
    env.DB,
    "last_run",
    JSON.stringify({ at: Math.floor(Date.now() / 1000), ...report }),
  );

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
  return secretMatches(request.headers.get("x-bridge-secret"), env);
}

/** The dashboard carries the same secret in an HttpOnly cookie. */
function isDashboardAuthorised(request: Request, env: Env): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  const value = cookie.match(/(?:^|;\s*)mk=([^;]*)/)?.[1];
  return secretMatches(value ? decodeURIComponent(value) : null, env);
}

function secretMatches(presented: string | null, env: Env): boolean {
  const expected = env.BRIDGE_SHARED_SECRET ?? "";
  if (expected.length < MIN_SECRET_LENGTH) return false;

  const candidate = presented ?? "";
  if (candidate.length !== expected.length) return false;

  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= candidate.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
