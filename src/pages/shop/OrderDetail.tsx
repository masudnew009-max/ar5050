import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2, CheckCircle2, Package, MapPin, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Order, OrderItem } from '../../lib/supabase';
import { formatPrice } from '../../lib/format';

type ItemWithProduct = OrderItem & { product: { name: string; image_url: string | null } | null };
type OrderWithItems = Omit<Order, 'items'> & { items: ItemWithProduct[] };

const orderShortId = (id: string) => id.slice(0, 8).toUpperCase();

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const justPlaced = order ? Date.now() - new Date(order.created_at).getTime() < 2 * 60 * 1000 : false;

  useEffect(() => {
    if (!id) return;
    supabase
      .from('orders')
      .select('*, items:order_items(*, product:products(name, image_url))')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        setOrder(data as OrderWithItems | null);
        setLoading(false);
      });
  }, [id]);

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
            Payment: {order.payment_method === 'cod' ? 'Cash on Delivery' : 'Online'} · {order.payment_status.replace('_', ' ')}
          </p>
        </div>

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
