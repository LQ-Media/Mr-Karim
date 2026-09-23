/**
 * Server-rendered dashboard. Phone-first: the queue is the product, and it
 * should answer "what needs me right now" before any scrolling.
 *
 * Every value rendered here originates in an email or a WhatsApp message and
 * is therefore untrusted. Everything goes through escape().
 */

export interface QueueRow {
  id: string;
  source: string;
  sender: string;
  sender_name: string | null;
  subject: string | null;
  received_at: number;
  category: string;
  urgency: string;
  needs_reply: number;
  is_bill: number;
  summary: string;
  reasoning: string;
}

export interface Totals {
  messages: number;
  triaged: number;
  open_bills: number;
}

const URGENCY_ORDER = ["now", "today", "this_week", "whenever", "none"];

const URGENCY_LABEL: Record<string, string> = {
  now: "Now",
  today: "Today",
  this_week: "This week",
  whenever: "Whenever",
  none: "No action",
};

function escape(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Singapore time, since that is where the operator and the deadlines are. */
function whenLabel(unixSeconds: number): string {
  const then = unixSeconds * 1000;
  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h ago`;
  return new Date(then).toLocaleDateString("en-SG", {
    timeZone: "Asia/Singapore",
    day: "numeric",
    month: "short",
  });
}

function card(row: QueueRow): string {
  const who = row.sender_name || row.sender;
  const flags = [
    row.is_bill ? '<span class="flag bill">Bill</span>' : "",
    row.needs_reply ? '<span class="flag reply">Needs reply</span>' : "",
  ].join("");

  return `<article class="card ${escape(row.urgency)}">
  <header>
    <span class="who">${escape(who)}</span>
    <span class="when">${escape(whenLabel(row.received_at))}</span>
  </header>
  <p class="summary">${escape(row.summary)}</p>
  ${row.subject ? `<p class="subject">${escape(row.subject)}</p>` : ""}
  <footer>
    <span class="tag ${escape(row.category)}">${escape(row.category)}</span>
    <span class="tag src">${escape(row.source.replace("wa_", "WhatsApp "))}</span>
    ${flags}
  </footer>
  <details><summary>Why</summary><p>${escape(row.reasoning)}</p></details>
</article>`;
}

export function renderDashboard(rows: QueueRow[], totals: Totals): string {
  const grouped = URGENCY_ORDER.map((urgency) => ({
    urgency,
    items: rows.filter((r) => r.urgency === urgency),
  })).filter((group) => group.items.length > 0);

  const actionable = rows.filter(
    (r) => r.urgency === "now" || r.urgency === "today",
  ).length;

  const body =
    rows.length === 0
      ? `<div class="empty">
           <p><strong>Nothing classified yet.</strong></p>
           <p>Cron polls every 30 minutes. Use <em>Poll now</em> to fetch
              immediately — it looks back 24 hours.</p>
         </div>`
      : grouped
          .map(
            (group) => `<section>
  <h2>${escape(URGENCY_LABEL[group.urgency] ?? group.urgency)}
    <span class="count">${group.items.length}</span></h2>
  ${group.items.map(card).join("\n")}
</section>`,
          )
          .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Mr Karim</title>
<style>
  :root {
    --bg: #fbfaf8; --surface: #fff; --line: #e6e2dc;
    --text: #1c1a17; --muted: #6b655c;
    --now: #b4321f; --today: #b06a14; --week: #4a6fa5; --calm: #6b655c;
    --accent: #1c1a17; --accent-text: #fff;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #16150f; --surface: #1f1e17; --line: #332f26;
      --text: #f0ece4; --muted: #9a9287;
      --now: #f08a72; --today: #e0ac5e; --week: #8fb0da; --calm: #9a9287;
      --accent: #f0ece4; --accent-text: #16150f;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0 16px 64px;
    background: var(--bg); color: var(--text);
    font: 16px/1.5 ui-sans-serif, -apple-system, system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 720px; margin: 0 auto; }
  .top { padding: 28px 0 20px; }
  h1 { margin: 0; font-size: 1.5rem; letter-spacing: -0.02em; }
  .lede { margin: 6px 0 0; color: var(--muted); font-size: 0.95rem; }
  .bar { display: flex; gap: 8px; margin-top: 18px; flex-wrap: wrap; }
  button, .btn {
    font: inherit; font-size: 0.9rem; cursor: pointer;
    padding: 9px 16px; border-radius: 999px;
    border: 1px solid var(--line); background: var(--surface); color: var(--text);
  }
  button.primary { background: var(--accent); color: var(--accent-text); border-color: var(--accent); }
  button:disabled { opacity: 0.5; cursor: default; }
  h2 {
    display: flex; align-items: center; gap: 8px;
    margin: 28px 0 10px; font-size: 0.8rem;
    text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted);
  }
  .count {
    font-size: 0.75rem; letter-spacing: 0; padding: 1px 8px;
    border-radius: 999px; background: var(--surface); border: 1px solid var(--line);
  }
  .card {
    background: var(--surface); border: 1px solid var(--line);
    border-left: 3px solid var(--calm);
    border-radius: 10px; padding: 14px 16px; margin-bottom: 10px;
  }
  .card.now { border-left-color: var(--now); }
  .card.today { border-left-color: var(--today); }
  .card.this_week { border-left-color: var(--week); }
  .card header { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
  .who { font-weight: 600; overflow-wrap: anywhere; }
  .when { color: var(--muted); font-size: 0.8rem; white-space: nowrap; }
  .summary { margin: 6px 0 0; overflow-wrap: anywhere; }
  .subject { margin: 4px 0 0; color: var(--muted); font-size: 0.875rem; overflow-wrap: anywhere; }
  .card footer { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
  .tag, .flag {
    font-size: 0.72rem; padding: 2px 9px; border-radius: 999px;
    border: 1px solid var(--line); color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  .flag.bill { color: var(--today); border-color: currentColor; }
  .flag.reply { color: var(--week); border-color: currentColor; }
  details { margin-top: 8px; }
  details summary {
    cursor: pointer; color: var(--muted);
    font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.06em;
  }
  details p { margin: 6px 0 0; color: var(--muted); font-size: 0.875rem; }
  .empty {
    border: 1px dashed var(--line); border-radius: 10px;
    padding: 28px 20px; text-align: center; color: var(--muted);
  }
  .empty p { margin: 0 0 6px; }
  .foot { margin-top: 32px; color: var(--muted); font-size: 0.8rem; }
</style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <h1>Mr Karim</h1>
    <p class="lede">${actionable} need${actionable === 1 ? "s" : ""} you ·
      ${totals.triaged} of ${totals.messages} classified ·
      ${totals.open_bills} open bill${totals.open_bills === 1 ? "" : "s"}</p>
    <div class="bar">
      <button class="primary" id="poll">Poll now</button>
      <button id="refresh">Refresh</button>
    </div>
  </div>
  ${body}
  <p class="foot">Draft only. Nothing is ever sent without you.</p>
</div>
<script>
  const poll = document.getElementById("poll");
  poll.addEventListener("click", async () => {
    poll.disabled = true;
    poll.textContent = "Polling…";
    try {
      const res = await fetch("/admin/poll?minutes=1440&max=40", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = await res.json();
      poll.textContent = "Fetched " + data.fetched + ", triaged " + data.triaged;
      setTimeout(() => location.reload(), 1200);
    } catch (err) {
      poll.textContent = "Failed — try again";
      poll.disabled = false;
    }
  });
  document.getElementById("refresh")
    .addEventListener("click", () => location.reload());
</script>
</body>
</html>`;
}

export function renderLocked(): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Mr Karim</title>
<style>
  body { margin:0; display:grid; place-items:center; min-height:100vh; padding:24px;
    background:#fbfaf8; color:#1c1a17;
    font:16px/1.6 ui-sans-serif,-apple-system,system-ui,sans-serif; }
  @media (prefers-color-scheme: dark) { body { background:#16150f; color:#f0ece4; } }
  div { max-width: 30rem; text-align: center; }
  code { font-size: 0.85rem; overflow-wrap: anywhere; }
</style>
</head><body><div>
<p><strong>Locked.</strong></p>
<p>Open this page once with your key appended:</p>
<p><code>/?k=YOUR_BRIDGE_SHARED_SECRET</code></p>
<p>It is then remembered on this device.</p>
</div></body></html>`;
}
