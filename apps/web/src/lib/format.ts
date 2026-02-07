export function formatYusd(amount: number): string {
  if (!Number.isFinite(amount)) return "0";
  const fixed = amount.toFixed(6);
  return fixed.replace(/\.?(0+)$/, "").replace(/\.$/, "");
}
