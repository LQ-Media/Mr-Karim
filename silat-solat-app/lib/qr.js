import "server-only";
import QRCode from "qrcode";

/** An inline SVG string for a QR code (check-in links, PayNow). */
export async function qrSvg(text, { dark = "#17140F", light = "#FFFFFF" } = {}) {
  return QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark, light } });
}
