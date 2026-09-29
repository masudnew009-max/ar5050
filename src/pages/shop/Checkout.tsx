import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader2, Package, Minus, Plus, LogIn, Truck, Banknote, ArrowLeft, ShoppingCart, AlertTriangle } from 'lucide-react';
import { supabase, Product, DeliveryZone } from '../../lib/supabase';
import { useCart } from '../../hooks/useCart';
import { useAuth } from '../../hooks/useAuth';
import { formatPrice } from '../../lib/format';
import { AuthModal } from '../../components/AuthModal';

const BD_PHONE = /^(?:\+?88)?01[3-9]\d{8}$/;

/** One order line — either the single "Buy Now" product or one cart item. */
type Line = { id: string; name: string; price: number; unit: string; imageUrl: string | null; stock: number; qty: number };

export default function Checkout() {
  const { productId } = useParams<{ productId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { items: cartItems, clear: clearCart } = useCart();

  // /checkout/:productId = "Buy Now" (one product). /checkout = the whole cart (Phase 15চ).
  const cartMode = !productId;

  const [lines, setLines] = useState<Line[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [zones, setZones] = useState<Pick<DeliveryZone, 'zilla' | 'thana' | 'delivery_charge'>[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [zilla, setZilla] = useState('');
  const [thana, setThana] = useState('');
  const [address, setAddress] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  const cartKey = cartItems.map((i) => `${i.productId}:${i.qty}`).sort().join(',');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ids = cartMode ? cartItems.map((i) => i.productId) : productId ? [productId] : [];
      if (ids.length === 0) {
        setLines([]);
        setMissing([]);
        setLoading(false);
        return;
      }
      const [productRes, zonesRes] = await Promise.all([
        supabase.from('products').select('*').in('id', ids).eq('status', 'approved').eq('is_active', true),
        supabase.from('delivery_zones').select('zilla, thana, delivery_charge').order('zilla').order('thana'),
      ]);
      if (cancelled) return;
      const found = new Map(((productRes.data as Product[]) ?? []).map((p) => [p.id, p]));
      setZones((zonesRes.data as typeof zones) ?? []);

      if (cartMode) {
        const next: Line[] = [];
        const gone: string[] = [];
        for (const ci of cartItems) {
          const p = found.get(ci.productId);
          if (!p) gone.push(ci.name);
          else next.push({ id: p.id, name: p.name, price: p.price, unit: p.unit || 'pcs', imageUrl: p.image_url, stock: p.stock, qty: ci.qty });
        }
        setLines(next);
        setMissing(gone);
      } else {
        const p = found.get(ids[0]);
        const wanted = Math.max(1, Number(searchParams.get('qty')) || 1);
        setLines(
          p
            ? [{ id: p.id, name: p.name, price: p.price, unit: p.unit || 'pcs', imageUrl: p.image_url, stock: p.stock, qty: Math.min(wanted, Math.max(1, p.stock)) }]
            : []
        );
        setMissing([]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, cartMode, cartKey]);

  // Prefill from the signed-in profile (only into empty fields)
  useEffect(() => {
    if (profile?.full_name) setName((n) => n || profile.full_name!);
    if (profile?.mobile_number) setPhone((p) => p || profile.mobile_number!);
  }, [profile]);

  const zillas = useMemo(() => [...new Set(zones.map((z) => z.zilla))], [zones]);
  const thanas = useMemo(() => zones.filter((z) => z.zilla === zilla).map((z) => z.thana), [zones, zilla]);
  const deliveryCharge = useMemo(() => {
    const z = zones.find((x) => x.zilla === zilla && x.thana === thana);
    return z ? Number(z.delivery_charge) : null;
  }, [zones, zilla, thana]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="text-center py-24 text-white">
        {cartMode ? <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-dark-500" /> : <Package className="w-12 h-12 mx-auto mb-3 text-dark-500" />}
        <p className="mb-4 text-dark-400">
          {cartMode
            ? missing.length > 0
              ? 'The items in your cart are no longer available.'
              : 'Your cart is empty.'
            : "This product isn't available."}
        </p>
        <Link to={cartMode && missing.length > 0 ? '/cart' : '/shop'} className="text-primary-400 hover:text-primary-300">
          {cartMode && missing.length > 0 ? 'Go to cart' : 'Back to shop'}
        </Link>
      </div>
    );
  }

  const stockProblem = lines.some((l) => l.stock <= 0 || l.qty > l.stock);
  const blocked = stockProblem || missing.length > 0;
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const total = subtotal + (deliveryCharge ?? 0);
  const changeQty = (id: string, delta: number) =>
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, qty: Math.min(Math.max(1, l.stock), Math.max(1, l.qty + delta)) } : l))
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      setShowAuth(true);
      return;
    }
    if (!name.trim()) return setError('Please enter your name.');
    if (!BD_PHONE.test(phone.trim())) return setError('Please enter a valid mobile number (e.g. 01712345678).');
    if (!zilla || !thana) return setError('Please select your Zilla and Thana.');
    if (!address.trim()) return setError('Please enter your full delivery address.');

    if (blocked) return setError('Some items are unavailable or exceed stock. Please review your cart.');

    setSubmitting(true);
    const { data, error: rpcError } = await supabase.rpc('place_order', {
      p_customer_name: name.trim(),
      p_customer_phone: phone.trim(),
      p_delivery_address: address.trim(),
      p_zilla: zilla,
      p_thana: thana,
      p_payment_method: 'cod',
      p_items: lines.map((l) => ({ product_id: l.id, quantity: l.qty })),
    });
    setSubmitting(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    // Fire-and-forget: email the seller(s). A failure here must never block or
    // undo the order, so errors are ignored (the function de-duplicates itself).
    void supabase.functions.invoke('notify-seller', { body: { order_id: data as string } }).catch(() => {});

    navigate(`/orders/${data as string}`, { replace: true });
    if (cartMode) clearCart(); // the whole cart was ordered
  };

  const inputClass =
    'w-full px-4 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder-dark-500 focus:border-primary-500';

  return (
    <div className="text-white max-w-5xl mx-auto">
      <Link
        to={cartMode ? '/cart' : `/product/${lines[0].id}`}
        className="inline-flex items-center gap-1 text-sm text-dark-400 hover:text-white mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> {cartMode ? 'Back to cart' : 'Back to product'}
      </Link>
      <h1 className="text-2xl font-bold mb-6">Checkout</h1>

      <form onSubmit={submit} className="grid lg:grid-cols-5 gap-6">
        {/* Delivery details */}
        <div className="lg:col-span-3 space-y-4">
          {!user && (
            <div className="flex items-center justify-between gap-3 p-4 bg-primary-600/10 border border-primary-600/30 rounded-xl">
              <p className="text-sm text-primary-300">Sign in to place your order.</p>
              <button
                type="button"
                onClick={() => setShowAuth(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg text-sm font-medium"
              >
                <LogIn className="w-4 h-4" /> Sign in
              </button>
            </div>
          )}

          <div className="bg-dark-800/60 border border-dark-700 rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Truck className="w-4 h-4 text-primary-400" /> Delivery details
            </h2>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-dark-400 mb-1">Full name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Your name" />
              </div>
              <div>
                <label className="block text-sm text-dark-400 mb-1">Mobile number</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  className={inputClass}
                  placeholder="01XXXXXXXXX"
                />
              </div>
            </div>

            {zones.length === 0 ? (
              <p className="text-sm text-yellow-400">
                Delivery areas haven't been set up yet, so orders can't be placed right now.
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-dark-400 mb-1">Zilla</label>
                  <select
                    value={zilla}
                    onChange={(e) => {
                      setZilla(e.target.value);
                      setThana('');
                    }}
                    className={`${inputClass} appearance-none pr-10`}
                  >
                    <option value="">Select Zilla</option>
                    {zillas.map((z) => (
                      <option key={z} value={z}>{z}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-dark-400 mb-1">Thana</label>
                  <select
                    value={thana}
                    onChange={(e) => setThana(e.target.value)}
                    disabled={!zilla}
                    className={`${inputClass} appearance-none pr-10 disabled:opacity-50`}
                  >
                    <option value="">Select Thana</option>
                    {thanas.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm text-dark-400 mb-1">Full address</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                className={inputClass}
                placeholder="House, road, village/area, landmark"
              />
            </div>
          </div>

          <div className="bg-dark-800/60 border border-dark-700 rounded-2xl p-5">
            <h2 className="font-semibold flex items-center gap-2 mb-3">
              <Banknote className="w-4 h-4 text-primary-400" /> Payment
            </h2>
            <label className="flex items-center gap-3 p-3 rounded-xl border border-primary-600 bg-primary-600/10">
              <input type="radio" checked readOnly />
              <span className="text-sm">Cash on Delivery — pay when you receive your order</span>
            </label>
          </div>
        </div>

        {/* Summary */}
        <div className="lg:col-span-2">
          <div className="bg-dark-800/60 border border-dark-700 rounded-2xl p-5 lg:sticky lg:top-24">
            <h2 className="font-semibold mb-4">Order summary</h2>

            {(missing.length > 0 || stockProblem) && (
              <div className="flex gap-2 items-start bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs rounded-xl p-3 mb-4">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <p>
                  {missing.length > 0 && <>No longer available: {missing.join(', ')}. </>}
                  {stockProblem && <>Some quantities exceed current stock. </>}
                  <Link to="/cart" className="underline">Fix in cart</Link>
                </p>
              </div>
            )}

            <div className="space-y-4 mb-4">
              {lines.map((l) => (
                <div key={l.id}>
                  <div className="flex gap-3">
                    <div className="w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-dark-700 flex items-center justify-center">
                      {l.imageUrl ? (
                        <img src={l.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-6 h-6 text-dark-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium line-clamp-2">{l.name}</p>
                      <p className="text-sm text-dark-400">{formatPrice(l.price)} / {l.unit}</p>
                    </div>
                    {cartMode && <p className="text-sm text-dark-300 self-center shrink-0">× {l.qty}</p>}
                  </div>
                  {!cartMode && (
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-sm text-dark-400">Quantity</span>
                      <div className="flex items-center bg-dark-900 border border-dark-700 rounded-xl">
                        <button type="button" onClick={() => changeQty(l.id, -1)} className="p-2 text-dark-300 hover:text-white" aria-label="Decrease">
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-9 text-center text-sm font-medium">{l.qty}</span>
                        <button type="button" onClick={() => changeQty(l.id, 1)} className="p-2 text-dark-300 hover:text-white" aria-label="Increase">
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-2 text-sm border-t border-dark-700 pt-4">
              <div className="flex justify-between">
                <span className="text-dark-400">Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">Delivery charge</span>
                <span>{deliveryCharge === null ? 'Select area' : formatPrice(deliveryCharge)}</span>
              </div>
              <div className="flex justify-between text-base font-bold pt-2 border-t border-dark-700">
                <span>Total</span>
                <span className="text-primary-400">{formatPrice(total)}</span>
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || zones.length === 0 || blocked}
              className="mt-5 w-full flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold shadow-lg shadow-primary-600/30"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {user ? 'Place Order' : 'Sign in to order'}
            </button>
            <p className="text-xs text-dark-500 text-center mt-3">
              The final price and delivery charge are confirmed by the server when you place the order.
            </p>
          </div>
        </div>
      </form>

      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
    </div>
  );
}
