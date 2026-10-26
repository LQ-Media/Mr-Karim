import { test } from "node:test";
import assert from "node:assert/strict";
import { clean, merge, logActivity, streak, toggleJuz, completeKhatam, tapTasbih, resetTasbih, setBookmark, today } from "../lib/progress/model.js";

const at = (s) => new Date(`${s}T04:00:00Z`); // noon in Singapore

test("today is the Singapore date", () => {
  assert.equal(today(new Date("2026-10-16T17:00:00Z")), "2026-10-17");
});

test("streak counts days in a row and survives an empty morning", () => {
  let p = clean(null);
  for (const d of ["2026-10-13", "2026-10-14", "2026-10-15"]) p = logActivity(p, "quran", 1, at(d));
  assert.equal(streak(p, at("2026-10-15")), 3);
  assert.equal(streak(p, at("2026-10-16")), 3); // nothing yet today: still 3
  assert.equal(streak(p, at("2026-10-17")), 0); // a whole day missed
});

test("merging keeps the work from both devices", () => {
  let phone = logActivity(clean(null), "dua", 2, at("2026-10-10"));
  phone = toggleJuz(phone, 1, at("2026-10-10"));
  let account = logActivity(clean(null), "quran", 1, at("2026-10-11"));
  account = toggleJuz(account, 30, at("2026-10-11"));
  const m = merge(phone, account);
  assert.deepEqual(Object.keys(m.days).sort(), ["2026-10-10", "2026-10-11"]);
  assert.deepEqual(m.juz, [1, 30]);
});

test("a finished khatam wins over an older juz list", () => {
  let a = clean(null);
  for (let j = 1; j <= 30; j++) a = toggleJuz(a, j, at("2026-10-10"));
  a = completeKhatam(a, at("2026-10-11"));
  const b = toggleJuz(clean(null), 5, at("2026-10-01"));
  const m = merge(a, b);
  assert.equal(m.khatams, 1);
  assert.deepEqual(m.juz, []);
});

test("tasbih keeps the larger total and the newer counter", () => {
  let a = tapTasbih(tapTasbih(clean(null), at("2026-10-10")), at("2026-10-10"));
  let b = resetTasbih(a, at("2026-10-12"));
  b = tapTasbih(b, at("2026-10-12"));
  const m = merge(a, b);
  assert.equal(m.tasbih.total, 3);
  assert.equal(m.tasbih.count, 1);
});

test("the newer bookmark wins and bad data is dropped", () => {
  const a = setBookmark(clean(null), { chapterId: 2, verseKey: "2:255" }, at("2026-10-10"));
  const b = setBookmark(clean(null), { chapterId: 18, verseKey: "18:10" }, at("2026-10-12"));
  assert.equal(merge(a, b).bookmark.verseKey, "18:10");
  const junk = clean({ days: { "not-a-day": { quran: 1 }, "2026-10-01": { quran: -5, hack: 9 } }, juz: [0, 31, "3"], bookmark: { chapterId: 999, verseKey: "x" } });
  assert.deepEqual(junk.days, {});
  assert.deepEqual(junk.juz, [3]);
  assert.equal(junk.bookmark, null);
});
