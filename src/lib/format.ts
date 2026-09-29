export function formatPrice(amount: number): string {
  return `৳${Number(amount).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

/** 1234 -> "1.2K", 2500000 -> "2.5M" */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}
