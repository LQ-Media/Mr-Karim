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

import Anthropic, {
  AuthenticationError,
  BadRequestError,
  RateLimitError,
} from "@anthropic-ai/sdk";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  TRIAGE_MODEL,
  buildSystemPrompt,
  triage,
} from "../src/triage.ts";
import type { TriageResult } from "../src/types.ts";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// Haiku 4.5, USD per million tokens. Cache writes bill at 1.25x the input
// rate, cache reads at 0.1x.
const RATE = { input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.1 };

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

/**
 * Parses the plain-text format used by test/real.txt: optional headers, then
 * `---`, then the body; messages separated by a line of `===`. Far less
 * fiddly than JSON when you are pasting real messages out of Mail or WhatsApp.
 */
function parsePlainText(raw: string): Sample[] {
  return raw
    .split(/^===\s*$/m)
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((l) => !l.startsWith("#"))
        .join("\n")
        .trim(),
    )
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => {
      const split = chunk.match(/^([\s\S]*?)\n---\n([\s\S]*)$/);
      const headerText = split ? split[1] : "";
      const body = (split ? split[2] : chunk).trim();

      const header = (name: string) =>
        headerText.match(new RegExp(`^${name}:\\s*(.+)$`, "im"))?.[1]?.trim();

      const from = header("From") ?? "unknown";
      // "Nurul (+6591234567)" or "IRAS <noreply@iras.gov.sg>" or a bare address
      const addr = from.match(/[<(]([^>)]+)[>)]/)?.[1] ?? from;
      const name = from.replace(/\s*[<(][^>)]+[>)]\s*/, "").trim();

      return {
        source: header("Source") ?? "gmail",
        account: header("Account") ?? "unspecified",
        sender: addr,
        sender_name: name.length > 0 ? name : null,
        subject: header("Subject") ?? null,
        body,
      } satisfies Sample;
    });
}

const realPath = join(here, "real.txt");
const usingReal = existsSync(realPath);

// The example file runs fine as-is, which makes it easy to think you have
// tested on real messages when you have only re-run the placeholders.
if (usingReal) {
  const example = readFileSync(join(here, "real.example.txt"), "utf8");
  const stripComments = (t: string) =>
    t.split("\n").filter((l) => !l.startsWith("#")).join("\n").trim();
  if (stripComments(readFileSync(realPath, "utf8")) === stripComments(example)) {
    console.error(
      "\ntest/real.txt still contains the example messages.\n\n" +
        "Open it, delete everything below the comment block, and paste in your\n" +
        "own real emails and WhatsApp messages. That is the actual test — the\n" +
        "placeholders only prove the script runs.\n",
    );
    process.exit(1);
  }
}

const samples: Sample[] = usingReal
  ? parsePlainText(readFileSync(realPath, "utf8"))
  : readFileSync(join(here, "samples.jsonl"), "utf8")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as Sample);

const SYSTEM = buildSystemPrompt(rules);

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "\nNo ANTHROPIC_API_KEY found.\n\n" +
      "Create a .env file in this directory containing:\n" +
      "  ANTHROPIC_API_KEY=sk-ant-api03-...\n\n" +
      "Get a key at console.anthropic.com under API Keys.\n",
  );
  process.exit(1);
}

const client = new Anthropic();

let cost = 0;

console.log(
  `\nTriaging ${samples.length} messages with ${TRIAGE_MODEL}` +
    `\nSource: ${usingReal ? "test/real.txt (your messages)" : "test/samples.jsonl (invented samples)"}` +
    `\n${"─".repeat(72)}`,
);

for (const s of samples) {
  let result: TriageResult;
  let usage;
  try {
    ({ result, usage } = await triage(client, SYSTEM, s));
  } catch (err) {
    if (err instanceof AuthenticationError) {
      console.error(
        "\nThe API key was rejected.\n\n" +
          "Check .env holds a current key — if you revoked one, create a new\n" +
          "key at console.anthropic.com and replace it.\n",
      );
    } else if (err instanceof RateLimitError) {
      console.error("\nRate limited. Wait a moment and run again.\n");
    } else if (err instanceof BadRequestError) {
      console.error(`\nRequest rejected: ${err.message}\n`);
    } else {
      console.error(`\nFailed on "${s.sender_name ?? s.sender}":`, err);
    }
    process.exit(1);
  }

  const t = result;
  const u = usage;
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
console.log(
  `\nCompare each classification against the "expected" line. Where it's wrong,\n` +
    `edit settings/rules.md and run again — that file is the fix, not the code.\n`,
);
