import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Package, Minus, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { supabase, Product } from '../../lib/supabase';
import { useCart } from '../../hooks/useCart';
import { formatPrice } from '../../lib/format';

type Fresh = Pick<Product, 'id' | 'seller_id' | 'name' | 'price' | 'unit' | 'image_url' | 'stock'>;

/** Phase 15ঙ/15চ: edit quantities, remove items, warn about stock / availability, proceed to /checkout. */
export default function Cart() {
  const { items, subtotal, setQty, removeItem, refreshItems, clear } = useCart();
  const [checked, setChecked] = useState(false);
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set());

  // Re-check live price/stock/availability whenever the set of cart products changes.
  const idKey = items.map((i) => i.productId).sort().join(',');
  useEffect(() => {
    if (!idKey) {
      setChecked(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const ids = idKey.split(',');
      const { data, error } = await supabase
        .from('products')
        .select('id, seller_id, name, price, unit, image_url, stock')
        .in('id', ids)
        .eq('status', 'approved')
        .eq('is_active', true);
      if (cancelled || error || !data) return; // offline / error: keep the saved snapshot silently
      const rows = data as Fresh[];
      const map: Record<string, Fresh> = {};
      rows.forEach((r) => (map[r.id] = r));
      refreshItems(map);
      setUnavailable(new Set(ids.filter((id) => !map[id])));
      setChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [idKey, refreshItems]);

  if (items.length === 0) {
    return (
      <div className="text-center py-24 text-white">
        <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-dark-500" />
        <p className="mb-4 text-dark-400">Your cart is empty.</p>
        <Link to="/shop" className="text-primary-400 hover:text-primary-300">
          Continue shopping
        </Link>
      </div>
    );
  }

  const problem = (id: string, qty: number, stock: number) =>
    unavailable.has(id) ? 'gone' : stock <= 0 ? 'soldout' : qty > stock ? 'over' : null;
  const hasProblem = items.some((i) => problem(i.productId, i.qty, i.stock));

  return (
    <div className="text-white max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Your Cart</h1>
        <button onClick={clear} className="text-sm text-dark-400 hover:text-red-400">
          Clear cart
        </button>
      </div>

      {hasProblem && (
        <div className="flex gap-2 items-start bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm rounded-xl p-3 mb-4">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>Some items need attention below. Fix or remove them before checking out.</p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((i) => {
          const issue = problem(i.productId, i.qty, i.stock);
          const maxQty = Math.max(1, i.stock);
          return (
            <div
              key={i.productId}
              className={`bg-dark-800 border rounded-2xl p-3 ${issue ? 'border-amber-500/40' : 'border-dark-700'}`}
            >
              <div className="flex gap-3">
                <Link
                  to={`/product/${i.productId}`}
                  className="w-16 h-16 rounded-xl bg-dark-700 overflow-hidden shrink-0 flex items-center justify-center"
                >
                  {i.imageUrl ? (
                    <img src={i.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-6 h-6 text-dark-500" />
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to={`/product/${i.productId}`} className="font-medium truncate block hover:text-primary-300">
                    {i.name}
                  </Link>
                  <p className="text-sm text-dark-400">
                    {formatPrice(i.price)} / {i.unit}
                  </p>
                </div>
                <button
                  onClick={() => removeItem(i.productId)}
                  className="self-start p-2 text-dark-400 hover:text-red-400"
                  aria-label={`Remove ${i.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center bg-dark-900 border border-dark-700 rounded-xl">
                  <button
                    onClick={() => setQty(i.productId, i.qty - 1)}
                    disabled={i.qty <= 1}
                    className="p-2 text-dark-300 hover:text-white disabled:opacity-40"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-9 text-center text-sm font-medium">{i.qty}</span>
                  <button
                    onClick={() => setQty(i.productId, Math.min(maxQty, i.qty + 1))}
                    disabled={i.qty >= maxQty}
                    className="p-2 text-dark-300 hover:text-white disabled:opacity-40"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <p className="font-semibold text-primary-400">{formatPrice(i.price * i.qty)}</p>
              </div>

              {issue === 'gone' && (
                <p className="text-xs text-amber-300 mt-2">This product is no longer available. Please remove it.</p>
              )}
              {issue === 'soldout' && <p className="text-xs text-amber-300 mt-2">Out of stock. Please remove it.</p>}
              {issue === 'over' && (
                <p className="text-xs text-amber-300 mt-2">
                  Only {i.stock} in stock.{' '}
                  <button onClick={() => setQty(i.productId, i.stock)} className="underline hover:text-amber-200">
                    Set quantity to {i.stock}
                  </button>
                </p>
              )}
              {!issue && checked && i.stock > 0 && i.stock <= 5 && (
                <p className="text-xs text-dark-400 mt-2">Only {i.stock} left</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between mt-4 pt-4 border-t border-dark-700 text-lg font-semibold">
        <span>Subtotal</span>
        <span className="text-primary-400">{formatPrice(subtotal)}</span>
      </div>
      <p className="text-xs text-dark-500 mt-1">Delivery charge is calculated at checkout.</p>
      {hasProblem ? (
        <button
          disabled
          className="mt-5 w-full py-3 bg-dark-700 text-dark-500 rounded-xl font-semibold cursor-not-allowed"
        >
          Fix the items above to continue
        </button>
      ) : (
        <Link
          to="/checkout"
          className="mt-5 block w-full text-center py-3 bg-primary-600 hover:bg-primary-700 rounded-xl font-semibold shadow-lg shadow-primary-600/30"
        >
          Proceed to Checkout
        </Link>
      )}
    </div>
  );
}
