import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2, CheckCircle2, Package, MapPin, ArrowLeft, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Order, OrderItem } from '../../lib/supabase';
import { formatPrice } from '../../lib/format';

type ItemWithProduct = OrderItem & { product: { name: string; image_url: string | null } | null };
type OrderWithItems = Omit<Order, 'items'> & { items: ItemWithProduct[] };

const orderShortId = (id: string) => id.slice(0, 8).toUpperCase();
const providerLabel = (code: string | null) => (code ? code.charAt(0).toUpperCase() + code.slice(1) : 'Online');

const PAY_STATUS_TEXT: Record<string, string> = {
  unpaid: 'Unpaid',
  pending_verification: 'Payment being verified',
  paid: 'Paid',
};

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [trx, setTrx] = useState('');
  const [sender, setSender] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const justPlaced = order ? Date.now() - new Date(order.created_at).getTime() < 2 * 60 * 1000 : false;

  const load = () => {
    if (!id) return Promise.resolve();
    return supabase
      .from('orders')
      .select('*, items:order_items(*, product:products(name, image_url))')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        setOrder(data as OrderWithItems | null);
        setLoading(false);
      });
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const resubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setPayError(null);
    setPayBusy(true);
    const { error } = await supabase.rpc('submit_payment_proof', {
      p_order_id: order.id,
      p_trx_id: trx.trim(),
      p_sender: sender.trim(),
    });
    setPayBusy(false);
    if (error) {
      setPayError(error.message);
      return;
    }
    setTrx('');
    setSender('');
    await load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-24 text-white">
        <p className="text-dark-400 mb-4">Order not found.</p>
        <Link to="/orders" className="text-primary-400 hover:text-primary-300">My orders</Link>
      </div>
    );
  }

  return (
    <div className="text-white max-w-2xl mx-auto">
      {justPlaced ? (
        <div className="text-center mb-8">
          <CheckCircle2 className="w-14 h-14 text-primary-400 mx-auto mb-3" />
          <h1 className="text-2xl font-bold mb-1">Order placed!</h1>
          <p className="text-dark-400 text-sm">We'll contact you on {order.customer_phone} to confirm delivery.</p>
        </div>
      ) : (
        <>
          <Link to="/orders" className="inline-flex items-center gap-1 text-sm text-dark-400 hover:text-white mb-4">
            <ArrowLeft className="w-4 h-4" /> My orders
          </Link>
          <h1 className="text-2xl font-bold mb-6">Order details</h1>
        </>
      )}

      <div className="bg-dark-800/60 border border-dark-700 rounded-2xl p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-dark-400">Order number</p>
            <p className="font-mono font-semibold">#{orderShortId(order.id)}</p>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full capitalize status-${order.status}`}>{order.status}</span>
        </div>

        <div className="space-y-3">
          {order.items.map((it) => (
            <div key={it.id} className="flex gap-3 items-center">
              <div className="w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-dark-700 flex items-center justify-center">
                {it.product?.image_url ? (
                  <img src={it.product.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-5 h-5 text-dark-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{it.product?.name ?? 'Product'}</p>
                <p className="text-xs text-dark-400">{it.quantity} × {formatPrice(it.unit_price)}</p>
              </div>
              <p className="text-sm font-medium">{formatPrice(it.subtotal)}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2 text-sm border-t border-dark-700 pt-4">
          <div className="flex justify-between"><span className="text-dark-400">Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-dark-400">Delivery ({order.thana}, {order.zilla})</span><span>{formatPrice(order.delivery_charge)}</span></div>
          <div className="flex justify-between text-base font-bold pt-2 border-t border-dark-700">
            <span>Total</span><span className="text-primary-400">{formatPrice(order.total_amount)}</span>
          </div>
          <p className="text-xs text-dark-400">
            Payment:{' '}
            {order.payment_method === 'cod'
              ? `Cash on Delivery · ${PAY_STATUS_TEXT[order.payment_status] ?? order.payment_status}`
              : `${providerLabel(order.payment_provider)} · ${PAY_STATUS_TEXT[order.payment_status] ?? order.payment_status}`}
          </p>
          {order.payment_method === 'online' && order.payment_trx_id && (
            <p className="text-xs text-dark-500">
              Transaction ID: {order.payment_trx_id}
              {order.payment_sender ? ` · from ${order.payment_sender}` : ''}
            </p>
          )}
        </div>

        {order.payment_method === 'online' && order.payment_status === 'unpaid' && order.status !== 'cancelled' && (
          <form onSubmit={resubmit} className="border-t border-dark-700 pt-4 space-y-3 text-sm">
            <div className="flex gap-2 items-start bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>
                We couldn&apos;t verify your payment.
                {order.payment_note ? ` Reason: ${order.payment_note}.` : ''} Please send the correct details below,
                or contact us.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                placeholder="Paid from (number / account)"
                className="w-full px-4 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder-dark-500 focus:border-primary-500"
              />
              <input
                value={trx}
                onChange={(e) => setTrx(e.target.value)}
                placeholder="Transaction ID"
                className="w-full px-4 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder-dark-500 focus:border-primary-500"
              />
            </div>
            {payError && <p className="text-red-400">{payError}</p>}
            <button
              type="submit"
              disabled={payBusy}
              className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-xl font-medium"
            >
              {payBusy ? 'Sending…' : 'Send payment details'}
            </button>
          </form>
        )}

        <div className="border-t border-dark-700 pt-4 text-sm">
          <p className="flex items-center gap-2 font-medium mb-1"><MapPin className="w-4 h-4 text-primary-400" /> Delivery address</p>
          <p className="text-dark-300">{order.customer_name} · {order.customer_phone}</p>
          <p className="text-dark-300 whitespace-pre-line">{order.delivery_address}</p>
          <p className="text-dark-400">{order.thana}, {order.zilla}</p>
        </div>
      </div>

      <div className="text-center mt-6">
        <Link to="/shop" className="text-primary-400 hover:text-primary-300 text-sm">Continue shopping</Link>
      </div>
    </div>
  );
}
