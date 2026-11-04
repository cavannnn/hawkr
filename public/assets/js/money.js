/**
 * "$9.50" | "9.50" | 9.5 -> 950.
 * Strips everything but digits and a dot, so odd input degrades to 0 rather than NaN.
 */
export function cents(v) {
  if (typeof v === "number") return Math.round(v * 100);
  return Math.round(
    (parseFloat(String(v == null ? "" : v).replace(/[^0-9.-]/g, "")) || 0) * 100,
  );
}

export function format(c) {
  return (
    "$" +
    ((c || 0) / 100).toLocaleString("en-SG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}
