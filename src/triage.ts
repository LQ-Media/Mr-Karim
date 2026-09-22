import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { TriageResult } from "./types.ts";

export const TRIAGE_MODEL = "claude-haiku-4-5";

export const TriageSchema = z.object({
  category: z.enum([
    "bank",
    "government",
    "supplier",
    "customer",
    "personal",
    "noise",
  ]),
  urgency: z.enum(["now", "today", "this_week", "whenever", "none"]),
  needs_reply: z.boolean(),
  is_bill: z.boolean(),
  summary: z.string().describe("One line for the queue view. Under 12 words."),
  reasoning: z.string().describe("One sentence on why this classification."),
});

/**
 * Shared by the Worker and the local test so what you evaluate is what runs.
 * The rules go last and uncached content after them, keeping the cached
 * prefix stable across every call.
 */
export function buildSystemPrompt(rules: string): string {
  return `You triage incoming messages for the operator described below.

Classify each message. Do not write replies — classification only.

Guidance:
- urgency "now" means it needs attention within the hour.
- needs_reply is true only if a human is waiting on a response from the
  operator. Automated notifications do not need replies.
- is_bill is true if there is an amount owed and a payee, whether or not the
  message uses the word "invoice".
- When genuinely unsure whether something matters, err toward surfacing it.

--- OPERATOR RULES ---
${rules}`;
}

export function formatForTriage(m: {
  source: string;
  sender: string;
  sender_name?: string | null;
  senderName?: string | null;
  subject?: string | null;
  body: string;
}): string {
  const name = m.sender_name ?? m.senderName ?? "unknown";
  return [
    `Source:  ${m.source}`,
    `From:    ${name} <${m.sender}>`,
    m.subject ? `Subject: ${m.subject}` : null,
    "",
    m.body,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export async function triage(
  client: Anthropic,
  systemPrompt: string,
  message: Parameters<typeof formatForTriage>[0],
): Promise<{ result: TriageResult; usage: Anthropic.Usage }> {
  const response = await client.messages.parse({
    model: TRIAGE_MODEL,
    max_tokens: 1024,
    system: [
      { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: formatForTriage(message) }],
    output_config: { format: zodOutputFormat(TriageSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("Triage returned no parsable output");
  }
  return { result: response.parsed_output, usage: response.usage };
}
