export function sgd(cents) {
  const n = (Number(cents) || 0) / 100;
  return `S$${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

/** A short payment reference people can read out: SS-7K2Q9. */
export function newRef() {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let s = "";
  for (let i = 0; i < 5; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `SS-${s}`;
}

/** Support plans: S$10 to S$100 in S$10 steps (spec, 25 Oct 2026). */
export const SUPPORT_AMOUNTS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
