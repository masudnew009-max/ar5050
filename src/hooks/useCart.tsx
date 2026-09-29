import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Product } from '../lib/supabase';

/** One line in the cart. price/stock are snapshots from when it was added (Phase 15ঙ re-checks them). */
export type CartItem = {
  productId: string;
  sellerId: string;
  name: string;
  price: number;
  unit: string;
  imageUrl: string | null;
  stock: number;
  qty: number;
};

interface CartContextValue {
  items: CartItem[];
  /** Total number of units (sum of quantities) — used for the header badge. */
  count: number;
  subtotal: number;
  addItem: (product: Product, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

const STORAGE_KEY = 'cart:v1';
const CartContext = createContext<CartContextValue | undefined>(undefined);

function read(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (i): i is CartItem =>
        i && typeof i.productId === 'string' && typeof i.qty === 'number' && i.qty > 0 && typeof i.price === 'number'
    );
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(read);

  // Persist on every change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage full / blocked — cart still works in memory */
    }
  }, [items]);

  // Keep other open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setItems(read());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const addItem = useCallback((product: Product, qty = 1) => {
    if (product.stock <= 0) return;
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      const nextQty = Math.min(product.stock, (existing?.qty ?? 0) + Math.max(1, qty));
      const line: CartItem = {
        productId: product.id,
        sellerId: product.seller_id,
        name: product.name,
        price: product.price,
        unit: product.unit || 'pcs',
        imageUrl: product.image_url,
        stock: product.stock,
        qty: nextQty,
      };
      return existing ? prev.map((i) => (i.productId === product.id ? line : i)) : [...prev, line];
    });
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    setItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, qty: Math.max(1, Math.floor(qty) || 1) } : i))
    );
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.qty, 0),
      subtotal: items.reduce((s, i) => s + i.price * i.qty, 0),
      addItem,
      setQty,
      removeItem,
      clear,
    }),
    [items, addItem, setQty, removeItem, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
