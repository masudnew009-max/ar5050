import type { Product, ReelWithProduct } from '../../lib/supabase';

/** One full-screen page in the feed. */
export type FeedItem =
  | { kind: 'reel'; key: string; reel: ReelWithProduct }
  | { kind: 'product'; key: string; product: Product };

/**
 * Mix product cards in between reels: one product card after every
 * `every` reels; leftovers of either kind go at the end.
 */
export function buildFeed(
  reels: ReelWithProduct[],
  products: Product[],
  every = 3
): FeedItem[] {
  const items: FeedItem[] = [];
  let p = 0;
  reels.forEach((reel, i) => {
    items.push({ kind: 'reel', key: `r-${reel.id}`, reel });
    if ((i + 1) % every === 0 && p < products.length) {
      items.push({ kind: 'product', key: `p-${products[p].id}`, product: products[p] });
      p += 1;
    }
  });
  for (; p < products.length; p += 1) {
    items.push({ kind: 'product', key: `p-${products[p].id}`, product: products[p] });
  }
  return items;
}
