import type { InboundMessage, TriageResult } from "./types.ts";

/** Stable id derived from the source and the provider's own id. */
export function messageId(source: string, externalId: string): string {
  return `${source}:${externalId}`;
}

/**
 * Stores a message, returning false if it was already present. The unique
 * constraint on (source, external_id) makes re-polling the same window safe.
 */
export async function insertMessage(
  db: D1Database,
  m: InboundMessage,
): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO messages
         (id, source, account, external_id, thread_id, sender, sender_name,
          subject, body, has_attachments, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      messageId(m.source, m.externalId),
      m.source,
      m.account,
      m.externalId,
      m.threadId,
      m.sender,
      m.senderName,
      m.subject,
      m.body,
      m.hasAttachments ? 1 : 0,
      m.receivedAt,
    )
    .run();

  return (result.meta.changes ?? 0) > 0;
}

export async function insertTriage(
  db: D1Database,
  id: string,
  t: TriageResult,
  model: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO triage
         (message_id, category, urgency, needs_reply, is_bill, summary,
          reasoning, model)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      t.category,
      t.urgency,
      t.needs_reply ? 1 : 0,
      t.is_bill ? 1 : 0,
      t.summary,
      t.reasoning,
      model,
    )
    .run();
}

/** Messages stored but not yet classified — what each cron run picks up. */
export async function untriagedMessages(
  db: D1Database,
  limit = 25,
): Promise<
  Array<{
    id: string;
    source: string;
    sender: string;
    sender_name: string | null;
    subject: string | null;
    body: string;
  }>
> {
  const { results } = await db
    .prepare(
      `SELECT m.id, m.source, m.sender, m.sender_name, m.subject, m.body
         FROM messages m
         LEFT JOIN triage t ON t.message_id = m.id
        WHERE t.message_id IS NULL
        ORDER BY m.received_at DESC
        LIMIT ?`,
    )
    .bind(limit)
    .all();
  return results as never;
}

export async function getState(
  db: D1Database,
  key: string,
): Promise<string | null> {
  const row = await db
    .prepare(`SELECT value FROM sync_state WHERE key = ?`)
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

export async function setState(
  db: D1Database,
  key: string,
  value: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO sync_state (key, value, updated_at)
       VALUES (?, ?, unixepoch())
       ON CONFLICT (key) DO UPDATE SET value = excluded.value,
                                       updated_at = excluded.updated_at`,
    )
    .bind(key, value)
    .run();
}

/** Operator rules: the D1 copy wins so edits need no redeploy. */
export async function loadRules(
  db: D1Database,
  fallback: string,
): Promise<string> {
  const row = await db
    .prepare(`SELECT value FROM settings WHERE key = 'rules'`)
    .first<{ value: string }>();
  return row?.value ?? fallback;
}
