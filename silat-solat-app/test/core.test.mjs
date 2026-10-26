import { test } from "node:test";
import assert from "node:assert/strict";
import { crc16, paynowPayload } from "../lib/paynow.js";
import { eligibility, nextSash, SASHES, sashName } from "../lib/sashes.js";
import { suggestNextGrading } from "../lib/grading.js";
import { clock, dateLabel } from "../lib/tr.js";
import { youtubeId } from "../lib/library.js";

test("CRC-16/CCITT-FALSE matches the standard check value", () => {
  assert.equal(crc16("123456789"), "29B1");
});

test("PayNow payload is well formed and self-checking", () => {
  const p = paynowPayload({ proxyType: "UEN", proxy: "T26SS0001A", amountCents: 2000, reference: "SS-7K2Q9" });
  assert.match(p, /^000201010212/);
  assert.ok(p.includes("0009SG.PAYNOW"));
  assert.ok(p.includes("540520.00"));
  assert.ok(p.includes("0108SS-7K2Q9"));
  assert.equal(p.slice(-4), crc16(p.slice(0, -4)));
});

test("PayNow mobile proxy uses type 0", () => {
  const p = paynowPayload({ proxyType: "MOBILE", proxy: "+6591234567" });
  assert.ok(p.includes("01010"));
  assert.match(p, /^000201010211/); // no amount: static
});

test("eligibility needs syllabus, attendance and time", () => {
  // A new member (no sash, -1) works towards the white sash: 8 classes, 2 months.
  const all = new Set(nextSash(-1).items.map(([id]) => id));
  assert.equal(nextSash(-1).key, "putih");
  assert.equal(eligibility({ level: -1, done: all, classesSince: 8, monthsSince: 2 }).eligible, true);
  assert.equal(eligibility({ level: -1, done: all, classesSince: 7, monthsSince: 2 }).eligible, false);
  assert.equal(eligibility({ level: -1, done: new Set(), classesSince: 50, monthsSince: 9 }).eligible, false);
  assert.equal(eligibility({ level: 5, done: new Set(), classesSince: 0, monthsSince: 0 }).target, null);
});

test("syllabus item ids are unique across the ladder", () => {
  const ids = SASHES.flatMap((s) => s.items.map(([id]) => id));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(sashName(1, "en"), "Yellow sash");
  assert.equal(sashName(0, "ms", 2), "Bengkung Putih · 2 jalur");
  assert.equal(sashName(-1, "en"), "No sash yet");
});

test("grading dates land on the last Saturday of a grading month", () => {
  assert.equal(suggestNextGrading("monthly", "2026-10-26"), "2026-10-31");
  assert.equal(suggestNextGrading("monthly", "2026-11-01"), "2026-11-28");
  assert.equal(suggestNextGrading("quarterly", "2026-10-26"), "2026-12-26");
  assert.equal(suggestNextGrading("bimonthly", "2026-10-26"), "2026-10-31");
  assert.equal(suggestNextGrading("adhoc", "2026-10-26"), null);
});

test("bilingual clock and dates", () => {
  assert.equal(clock("20:00", "ms"), "8:00 mlm");
  assert.equal(clock("09:30", "en"), "9:30 am");
  assert.equal(clock("12:30", "ms"), "12:30 tgh");
  assert.equal(dateLabel("2026-10-31", "ms"), "Sab, 31 Okt 2026");
  assert.equal(dateLabel("2026-10-31", "en", { weekday: false }), "31 Oct 2026");
});

test("YouTube ids from any link shape", () => {
  assert.equal(youtubeId("https://www.youtube.com/watch?v=KdU79Sj_12E&t=3"), "KdU79Sj_12E");
  assert.equal(youtubeId("https://youtu.be/mVpucGt95Rw"), "mVpucGt95Rw");
  assert.equal(youtubeId("not a link"), "");
});
