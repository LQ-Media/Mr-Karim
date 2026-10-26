import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { checkinSig, checkinValid, checkinPath } from "../lib/checkin.js";

test("check-in links are signed per class and day", () => {
  process.env.SESSION_SECRET = "s3cret";
  const sig = checkinSig("3", "2026-10-26");
  assert.ok(checkinValid("3", "2026-10-26", sig));
  assert.ok(!checkinValid("4", "2026-10-26", sig));
  assert.ok(!checkinValid("3", "2026-10-27", sig));
  assert.match(checkinPath("3", "2026-10-26"), /^\/checkin\?c=3&d=2026-10-26&s=/);
});

test("Stripe webhook signatures are checked", async () => {
  const secret = "whsec_test";
  const body = '{"type":"x"}';
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  const { verifyWebhook } = await import("../lib/stripe-signature.js");
  assert.ok(verifyWebhook(body, `t=${t},v1=${sig}`, secret));
  assert.ok(!verifyWebhook(body + " ", `t=${t},v1=${sig}`, secret));
  assert.ok(!verifyWebhook(body, `t=${t - 1000},v1=${sig}`, secret));
});
