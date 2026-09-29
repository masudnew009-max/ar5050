import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, ChevronDown, ChevronUp, MapPin, Phone } from 'lucide-react';
import { supabase, Order, OrderStatus, PaymentStatus } from '../../lib/supabase';
import { formatPrice } from '../../lib/format';

type Filter = 'all' | OrderStatus;

interface ItemRow {
  id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  commission_amount: number;
  seller_net_amount: number;
  products: { name: string } | { name: string }[] | null;
}

const ROW_LIMIT = 500;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'processing', label: 'Processing' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  pending_verification: 'Verifying',
  paid: 'Paid',
};

function productName(item: ItemRow): string {
  const p = Array.isArray(item.products) ? item.products[0] : item.products;
  return p?.name ?? 'Product';
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, ItemRow[]>>({});
  const [itemsLoading, setItemsLoading] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(ROW_LIMIT);
    if (error) setError(error.message);
    setOrders((data ?? []) as Order[]);
    setLoading(false);
  };

  const toggleExpand = async (orderId: string) => {
    if (expandedId === orderId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(orderId);
    if (itemsByOrder[orderId]) return;

    setItemsLoading(orderId);
    const { data, error } = await supabase
      .from('order_items')
      .select('id, quantity, unit_price, subtotal, commission_amount, seller_net_amount, products(name)')
      .eq('order_id', orderId);
    if (error) setError(error.message);
    else setItemsByOrder((prev) => ({ ...prev, [orderId]: (data ?? []) as unknown as ItemRow[] }));
    setItemsLoading(null);
  };

  const changeStatus = async (order: Order, next: OrderStatus) => {
    if (next === order.status) return;
    if (
      next === 'cancelled' &&
      !confirm('Cancel this order?\n\nThe items will be returned to stock and the order cannot be reopened.')
    ) {
      return;
    }
    setActingId(order.id);
    setError(null);
    const { error } = await supabase.from('orders').update({ status: next }).eq('id', order.id);
    if (error) setError(error.message);
    else setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: next } : o)));
    setActingId(null);
  };

  const rejectPayment = async (order: Order) => {
    const note = window.prompt('Why is this payment rejected? (the customer will see this)', 'Transaction ID not found');
    if (note === null) return;
    setActingId(order.id);
    setError(null);
    const { error } = await supabase
      .from('orders')
      .update({ payment_status: 'unpaid', payment_note: note.trim() || 'Payment could not be verified' })
      .eq('id', order.id);
    if (error) setError(error.message);
    else
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id ? { ...o, payment_status: 'unpaid', payment_note: note.trim() || 'Payment could not be verified' } : o
        )
      );
    setActingId(null);
  };

  const changePayment = async (order: Order, next: PaymentStatus) => {
    if (next === order.payment_status) return;
    setActingId(order.id);
    setError(null);
    const { error } = await supabase.from('orders').update({ payment_status: next, ...(next === 'paid' ? { payment_note: null } : {}) }).eq('id', order.id);
    if (error) setError(error.message);
    else setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, payment_status: next, ...(next === 'paid' ? { payment_note: null } : {}) } : o)));
    setActingId(null);
  };

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: orders.length, pending: 0, processing: 0, completed: 0, cancelled: 0 };
    orders.forEach((o) => {
      c[o.status] += 1;
    });
    return c;
  }, [orders]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter !== 'all' && o.status !== filter) return false;
      if (!q) return true;
      return (
        o.id.toLowerCase().startsWith(q.replace('#', '')) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_phone.toLowerCase().includes(q)
      );
    });
  }, [orders, filter, query]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>
      )}

      <div className="relative">
        <Search className="w-4 h-4 text-dark-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search customer name, phone or order #"
          className="w-full pl-9 pr-3 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-sm text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
              filter === f.id ? 'bg-primary-600 text-white' : 'bg-dark-800 text-dark-300 hover:text-white'
            }`}
          >
            {f.label} <span className="opacity-70">({counts[f.id]})</span>
          </button>
        ))}
      </div>

      {orders.length >= ROW_LIMIT && (
        <p className="text-xs text-dark-500">Showing the latest {ROW_LIMIT} orders.</p>
      )}

      {visible.length === 0 ? (
        <p className="text-dark-400 text-sm text-center py-12 bg-dark-800 border border-dark-700 rounded-2xl">
          No orders found.
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map((o) => {
            const locked = o.status === 'cancelled';
            const expanded = expandedId === o.id;
            const items = itemsByOrder[o.id];
            return (
              <div key={o.id} className="bg-dark-800 border border-dark-700 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      #{o.id.slice(0, 8)}
                      <span className="text-dark-500 font-normal text-xs ml-2">
                        {new Date(o.created_at).toLocaleString()}
                      </span>
                    </p>
                    <p className="text-sm text-dark-200 mt-1 truncate">{o.customer_name}</p>
                    <p className="text-xs text-dark-400 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" />
                      {o.customer_phone}
                    </p>
                    <p className="text-xs text-dark-400 flex items-start gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>{o.delivery_address}, {o.thana}, {o.zilla}</span>
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold">{formatPrice(Number(o.total_amount))}</p>
                    <p className="text-xs text-dark-500">
                      incl. {formatPrice(Number(o.delivery_charge))} delivery
                    </p>
                    <p className="text-xs text-dark-400 mt-1 uppercase">{o.payment_method}</p>
                  </div>
                </div>

                {o.payment_method === 'online' && (
                  <div className="mt-3 p-3 rounded-lg bg-dark-900 border border-dark-700 text-xs text-dark-300 space-y-1">
                    <p>
                      <span className="text-dark-500">Method:</span>{' '}
                      <span className="uppercase">{o.payment_provider ?? 'online'}</span> ·{' '}
                      <span className="text-dark-500">Amount to match:</span> {formatPrice(Number(o.total_amount))}
                    </p>
                    <p>
                      <span className="text-dark-500">TrxID:</span>{' '}
                      <span className="select-all font-medium text-white">{o.payment_trx_id ?? '—'}</span> ·{' '}
                      <span className="text-dark-500">From:</span> {o.payment_sender ?? '—'}
                    </p>
                    {o.payment_note && <p className="text-amber-300">Rejected: {o.payment_note}</p>}
                    {o.payment_status === 'pending_verification' && (
                      <div className="flex gap-2 pt-1">
                        <button
                          disabled={actingId === o.id}
                          onClick={() => changePayment(o, 'paid')}
                          className="px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium disabled:opacity-50"
                        >
                          Verify &amp; mark paid
                        </button>
                        <button
                          disabled={actingId === o.id}
                          onClick={() => rejectPayment(o)}
                          className="px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 text-xs font-medium disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="block text-[11px] text-dark-500 mb-1">Order status</span>
                    <select
                      value={o.status}
                      disabled={locked || actingId === o.id}
                      onChange={(e) => changeStatus(o, e.target.value as OrderStatus)}
                      className={`w-full px-2.5 py-2 rounded-lg text-sm border border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60 bg-dark-700 text-white`}
                    >
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-[11px] text-dark-500 mb-1">Payment</span>
                    <select
                      value={o.payment_status}
                      disabled={actingId === o.id}
                      onChange={(e) => changePayment(o, e.target.value as PaymentStatus)}
                      className="w-full px-2.5 py-2 rounded-lg text-sm border border-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60 bg-dark-700 text-white"
                    >
                      {(Object.keys(PAYMENT_LABELS) as PaymentStatus[]).map((k) => (
                        <option key={k} value={k}>{PAYMENT_LABELS[k]}</option>
                      ))}
                    </select>
                  </label>
                </div>

                {locked && (
                  <p className="text-xs text-dark-500 mt-2">Cancelled orders can't be reopened.</p>
                )}

                <button
                  onClick={() => toggleExpand(o.id)}
                  className="mt-3 flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300"
                >
                  {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {expanded ? 'Hide items' : 'View items'}
                </button>

                {expanded && (
                  <div className="mt-2 border-t border-dark-700 pt-3">
                    {itemsLoading === o.id ? (
                      <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                    ) : !items || items.length === 0 ? (
                      <p className="text-sm text-dark-500">No items found.</p>
                    ) : (
                      <div className="space-y-2">
                        {items.map((it) => (
                          <div key={it.id} className="flex items-start justify-between gap-3 text-sm">
                            <div className="min-w-0">
                              <p className="truncate">{productName(it)}</p>
                              <p className="text-xs text-dark-500">
                                {it.quantity} × {formatPrice(Number(it.unit_price))}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p>{formatPrice(Number(it.subtotal))}</p>
                              <p className="text-xs text-dark-500">
                                commission {formatPrice(Number(it.commission_amount))}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
