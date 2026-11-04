const PREFIX = "c2b-";
const WIDTH = 10;

export function formatTransactionId(orderId) {
  const digits = String(orderId ?? "").replace(/\D/g, "");
  

  if (!digits) return "—";
  return PREFIX + digits.padStart(WIDTH, "0").slice(-WIDTH);
}
