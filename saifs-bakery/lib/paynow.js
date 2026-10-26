// PayNow QR codes (SGQR / EMVCo merchant-presented format), adapted from the
// Silat & Solat app. The QR pays Ain's PayNow (PAYNOW_MOBILE or PAYNOW_UEN)
// with the amount and the order reference filled in. No payment-provider fee.

function tlv(id, value) {
  const v = String(value);
  return id + String(v.length).padStart(2, "0") + v;
}

/** CRC-16/CCITT-FALSE over the payload, as EMVCo requires. */
export function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * proxyType "UEN" | "MOBILE"; proxy "T12AB3456C" | "+6591234567";
 * amountCents optional (omit = payer types it); reference shows in the bank
 * statement (max 25 chars, letters, digits and dashes).
 */
export function paynowPayload({ proxyType, proxy, amountCents, reference, merchantName = "THE SAIFS BAKERY", editable = false }) {
  const merchantAccount =
    tlv("00", "SG.PAYNOW") +
    tlv("01", proxyType === "MOBILE" ? "0" : "2") +
    tlv("02", proxy) +
    tlv("03", editable ? "1" : "0");
  let p =
    tlv("00", "01") +
    tlv("01", amountCents ? "12" : "11") +
    tlv("26", merchantAccount) +
    tlv("52", "0000") +
    tlv("53", "702") +
    (amountCents ? tlv("54", (amountCents / 100).toFixed(2)) : "") +
    tlv("58", "SG") +
    tlv("59", merchantName.slice(0, 25)) +
    tlv("60", "Singapore") +
    (reference ? tlv("62", tlv("01", String(reference).replace(/[^A-Za-z0-9-]/g, "").slice(0, 25))) : "");
  p += "6304";
  return p + crc16(p);
}

/** The configured PayNow account, or null when PayNow isn't set up yet. */
export function paynowAccount() {
  const uen = String(process.env.PAYNOW_UEN || "").trim();
  const mobile = String(process.env.PAYNOW_MOBILE || "").trim();
  const name = String(process.env.PAYNOW_NAME || "THE SAIFS BAKERY").trim();
  if (uen) return { proxyType: "UEN", proxy: uen, name };
  if (mobile) return { proxyType: "MOBILE", proxy: mobile.startsWith("+") ? mobile : `+65${mobile}`, name };
  return null;
}
