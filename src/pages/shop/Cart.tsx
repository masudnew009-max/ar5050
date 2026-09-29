import { Link } from 'react-router-dom';
import { ShoppingCart, Package } from 'lucide-react';
import { useCart } from '../../hooks/useCart';
import { formatPrice } from '../../lib/format';

/** Phase 15ঘ: read-only list. Phase 15ঙ adds quantity editing, removal and stock warnings. */
export default function Cart() {
  const { items, subtotal } = useCart();

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

  return (
    <div className="text-white max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Your Cart</h1>
      <div className="space-y-3">
        {items.map((i) => (
          <Link
            key={i.productId}
            to={`/product/${i.productId}`}
            className="flex gap-3 bg-dark-800 border border-dark-700 rounded-2xl p-3"
          >
            <div className="w-16 h-16 rounded-xl bg-dark-700 overflow-hidden shrink-0 flex items-center justify-center">
              {i.imageUrl ? (
                <img src={i.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <Package className="w-6 h-6 text-dark-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{i.name}</p>
              <p className="text-sm text-dark-400">
                {formatPrice(i.price)} × {i.qty} {i.unit}
              </p>
            </div>
            <p className="font-semibold text-primary-400 self-center">{formatPrice(i.price * i.qty)}</p>
          </Link>
        ))}
      </div>
      <div className="flex justify-between mt-4 pt-4 border-t border-dark-700 text-lg font-semibold">
        <span>Subtotal</span>
        <span className="text-primary-400">{formatPrice(subtotal)}</span>
      </div>
    </div>
  );
}
