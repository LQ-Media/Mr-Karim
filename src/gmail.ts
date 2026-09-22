import type { InboundMessage } from "./types.ts";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

/** Read-only for now. Drafting replies later needs gmail.modify as well. */
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
] as const;

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailPart {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
}

interface GmailMessage {
  id: string;
  threadId: string;
  internalDate?: string;
  payload?: GmailPart & { headers?: GmailHeader[] };
}

/**
 * Exchanges a refresh token for a short-lived access token. Google's refresh
 * tokens do not expire for published apps, so this is the only auth step the
 * Worker performs.
 */
export async function accessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Google token refresh failed (${response.status}): ${await response.text()}`,
    );
  }
  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Google returned no access token");
  return json.access_token;
}

/** Message ids newer than `sinceSeconds` ago, newest first. */
export async function listRecent(
  token: string,
  sinceSeconds: number,
  max = 25,
): Promise<string[]> {
  const after = Math.floor(Date.now() / 1000) - sinceSeconds;
  const url =
    `${API}/messages?maxResults=${max}` +
    `&q=${encodeURIComponent(`after:${after} -in:chats`)}`;

  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(
      `Gmail list failed (${response.status}): ${await response.text()}`,
    );
  }
  const json = (await response.json()) as { messages?: Array<{ id: string }> };
  return (json.messages ?? []).map((m) => m.id);
}

export async function fetchMessage(
  token: string,
  account: string,
  id: string,
): Promise<InboundMessage> {
  const response = await fetch(`${API}/messages/${id}?format=full`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(
      `Gmail fetch ${id} failed (${response.status}): ${await response.text()}`,
    );
  }
  return toInbound((await response.json()) as GmailMessage, account);
}

function header(msg: GmailMessage, name: string): string | null {
  const found = msg.payload?.headers?.find(
    (h) => h.name.toLowerCase() === name.toLowerCase(),
  );
  return found?.value ?? null;
}

/** Gmail uses base64url, which atob does not accept directly. */
function decodeBody(data: string): string {
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "="));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Walks the MIME tree for readable text, preferring text/plain. Marketing mail
 * is frequently HTML-only, so the HTML is stripped rather than skipped.
 */
function extractBody(part: GmailPart | undefined): string {
  if (!part) return "";

  if (part.mimeType === "text/plain" && part.body?.data) {
    return decodeBody(part.body.data);
  }

  if (part.parts?.length) {
    for (const child of part.parts) {
      const text = extractBody(child);
      if (text.trim()) return text;
    }
  }

  if (part.mimeType === "text/html" && part.body?.data) {
    return decodeBody(part.body.data)
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
  }

  return "";
}

function hasAttachment(part: GmailPart | undefined): boolean {
  if (!part) return false;
  if (part.filename && part.filename.length > 0) return true;
  return (part.parts ?? []).some(hasAttachment);
}

export function toInbound(msg: GmailMessage, account: string): InboundMessage {
  const from = header(msg, "From") ?? "unknown";
  // `Nurul Aisyah <nurul@example.com>` or a bare address
  const address = from.match(/<([^>]+)>/)?.[1] ?? from;
  const name = from
    .replace(/<[^>]+>/, "")
    .replace(/^"|"$/g, "")
    .trim();

  const body = extractBody(msg.payload).slice(0, 12000);

  return {
    source: "gmail",
    account,
    externalId: msg.id,
    threadId: msg.threadId ?? null,
    sender: address.trim(),
    senderName: name.length > 0 ? name : null,
    subject: header(msg, "Subject"),
    body: body.trim() || "(no readable text body)",
    hasAttachments: hasAttachment(msg.payload),
    receivedAt: msg.internalDate
      ? Math.floor(Number(msg.internalDate) / 1000)
      : Math.floor(Date.now() / 1000),
  };
}
