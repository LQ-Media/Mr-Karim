import { test } from "node:test";
import assert from "node:assert/strict";
import { callMeOptions, cleanCallMe, firstNameWithTitle, firstWord } from "../lib/call-me.js";

test("choices come from the given name, stopping at bin/binte", () => {
  assert.deepEqual(callMeOptions("Nur Aisyah binte Ahmad"), ["Nur", "Aisyah", "Nur Aisyah"]);
  assert.deepEqual(callMeOptions("Muhammad Amir Bin Ali"), ["Muhammad", "Amir", "Muhammad Amir"]);
  assert.deepEqual(callMeOptions("Karim"), ["Karim"]);
  assert.deepEqual(callMeOptions(""), []);
});

test("a title is dropped, or kept in front on request", () => {
  assert.deepEqual(callMeOptions("Ustaz Karim"), ["Karim"]);
  assert.deepEqual(callMeOptions("Ustazah Nur Aisyah", { keepTitle: true }), [
    "Ustazah Nur", "Ustazah Aisyah", "Ustazah Nur Aisyah", "Nur", "Aisyah", "Nur Aisyah",
  ]);
});

test("Abdul is never offered alone", () => {
  assert.ok(!callMeOptions("Mohamed Abdul Karim").includes("Abdul"));
  assert.ok(callMeOptions("Mohamed Abdul Karim").includes("Abdul Karim"));
});

test("the old defaults and the saved shape", () => {
  assert.equal(firstWord("Nur Aisyah"), "Nur");
  assert.equal(firstNameWithTitle("Ustazah Nur Aisyah"), "Ustazah Nur");
  assert.equal(cleanCallMe("  Nur   Aisyah "), "Nur Aisyah");
  assert.equal(cleanCallMe("x".repeat(60)).length, 40);
});
