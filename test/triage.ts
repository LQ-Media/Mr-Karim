/**
 * Local triage test — no Cloudflare, no deployment, no database.
 *
 * Runs every message in samples.jsonl through the triage model using the real
 * rules from settings/rules.md, prints what it decided, and reports exactly
 * what it cost.
 *
 *   export ANTHROPIC_API_KEY=sk-ant-...
 *   npm run test:triage
 *
 * Replace samples.jsonl with your own real messages to find out whether the
 * agent's idea of "important" matches yours — before building anything on it.
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const TRIAGE_MODEL = "claude-haiku-4-5";

// Haiku 4.5, USD per million tokens. Cache writes bill at 1.25x the input
// rate, cache reads at 0.1x.
const RATE = { input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.1 };

const Triage = z.object({
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

interface Sample {
  source: string;
  account: string;
  sender: string;
  sender_name: string | null;
  subject: string | null;
  body: string;
  expect?: string;
}

const rules = readFileSync(join(here, "..", "settings", "rules.md"), "utf8");

const samples: Sample[] = readFileSync(join(here, "samples.jsonl"), "utf8")
  .split("\n")
  .filter((line) => line.trim().length > 0)
  .map((line) => JSON.parse(line) as Sample);

const SYSTEM = `You triage incoming messages for the operator described below.

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

const client = new Anthropic();

let cost = 0;
let mismatches = 0;

console.log(
  `\nTriaging ${samples.length} messages with ${TRIAGE_MODEL}\n${"─".repeat(72)}`,
);

for (const s of samples) {
  const header = [
    `Source:  ${s.source}`,
    `From:    ${s.sender_name ?? "unknown"} <${s.sender}>`,
    s.subject ? `Subject: ${s.subject}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.messages.parse({
    model: TRIAGE_MODEL,
    max_tokens: 1024,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `${header}\n\n${s.body}` }],
    output_config: { format: zodOutputFormat(Triage) },
  });

  const t = response.parsed_output;
  if (!t) {
    console.log(`\n✗ ${s.sender_name ?? s.sender} — could not parse output`);
    mismatches++;
    continue;
  }

  const u = response.usage;
  cost +=
    ((u.input_tokens ?? 0) * RATE.input +
      (u.output_tokens ?? 0) * RATE.output +
      (u.cache_creation_input_tokens ?? 0) * RATE.cacheWrite +
      (u.cache_read_input_tokens ?? 0) * RATE.cacheRead) /
    1_000_000;

  const flags = [
    t.needs_reply ? "needs reply" : null,
    t.is_bill ? "BILL" : null,
  ].filter(Boolean);

  console.log(`\n${s.sender_name ?? s.sender}  ·  ${s.source}`);
  console.log(`  ${t.category} / ${t.urgency}${flags.length ? " / " + flags.join(" / ") : ""}`);
  console.log(`  "${t.summary}"`);
  console.log(`  ${t.reasoning}`);
  if (s.expect) console.log(`  expected: ${s.expect}`);
}

console.log(`\n${"─".repeat(72)}`);
console.log(`Cost for this run: $${cost.toFixed(4)}`);
console.log(
  `At ~150 messages/day that projects to $${((cost / samples.length) * 150 * 30).toFixed(2)}/month for triage.`,
);
if (mismatches > 0) console.log(`${mismatches} message(s) failed to parse.`);
console.log(
  `\nCompare each classification against the "expected" line. Where it's wrong,\n` +
    `edit settings/rules.md and run again — that file is the fix, not the code.\n`,
);
