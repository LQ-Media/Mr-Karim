import { createHmac } from "node:crypto";

// A class's check-in QR is a link: /checkin?c=<class>&d=<day>&s=<sig>. Members
// scan it with their phone camera (no scanner in the app needed). The
// signature stops anyone making a valid link for a class or day by hand; the
// day must be today in Singapore, so an old photo of the code is no use.

function key() {
  return process.env.SESSION_SECRET || "dev-only-insecure-secret-change-me";
}

export function checkinSig(classId, day) {
  return createHmac("sha256", key()).update(`checkin:${classId}:${day}`).digest("base64url").slice(0, 16);
}

export function checkinPath(classId, day) {
  return `/checkin?c=${classId}&d=${day}&s=${checkinSig(classId, day)}`;
}

export function checkinValid(classId, day, sig) {
  return Boolean(classId && day && sig) && checkinSig(classId, day) === sig;
}
