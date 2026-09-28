export function formatPrice(amount: number): string {
  return `৳${Number(amount).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}
