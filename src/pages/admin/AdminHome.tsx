import { useEffect, useState, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Receipt, Wallet, ShoppingCart, Clock, Users, PackageCheck, Loader2 } from 'lucide-react';
import { supabase, OrderStatus } from '../../lib/supabase';
import { formatPrice } from '../../lib/format';

interface OrderRow {
  id: string;
  customer_name: string;
  total_amount: number;
  status: OrderStatus;
  created_at: string;
}

interface ItemRow {
  subtotal: number;
  commission_amount: number;
  orders: { status: OrderStatus } | { status: OrderStatus }[] | null;
}

const ROW_LIMIT = 1000;

function itemStatus(item: ItemRow): OrderStatus | undefined {
  const o = Array.isArray(item.orders) ? item.orders[0] : item.orders;
  return o?.status;
}

export default function AdminHome() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [sellerCount, setSellerCount] = useState(0);
  const [pendingProducts, setPendingProducts] = useState(0);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);

    const [ordersRes, itemsRes, sellersRes, pendingRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id, customer_name, total_amount, status, created_at')
        .order('created_at', { ascending: false })
        .limit(ROW_LIMIT),
      supabase
        .from('order_items')
        .select('subtotal, commission_amount, orders(status)')
        .limit(ROW_LIMIT),
      supabase.from('seller_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);

    const firstError = ordersRes.error || itemsRes.error || sellersRes.error || pendingRes.error;
    if (firstError) setError(firstError.message);

    setOrders((ordersRes.data ?? []) as OrderRow[]);
    setItems((itemsRes.data ?? []) as unknown as ItemRow[]);
    setSellerCount(sellersRes.count ?? 0);
    setPendingProducts(pendingRes.count ?? 0);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  const validItems = items.filter((i) => itemStatus(i) !== 'cancelled');
  const totalSales = validItems.reduce((s, i) => s + Number(i.subtotal), 0);
  const totalCommission = validItems.reduce((s, i) => s + Number(i.commission_amount), 0);
  const validOrders = orders.filter((o) => o.status !== 'cancelled');
  const pendingOrders = orders.filter((o) => o.status === 'pending').length;
  const recent = orders.slice(0, 6);
  const truncated = orders.length >= ROW_LIMIT || items.length >= ROW_LIMIT;

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <StatCard title="Total Sales" value={formatPrice(totalSales)} icon={<Receipt className="w-5 h-5" />} color="blue" />
        <StatCard title="Commission Earned" value={formatPrice(totalCommission)} icon={<Wallet className="w-5 h-5" />} color="green" />
        <StatCard title="Total Orders" value={String(validOrders.length)} icon={<ShoppingCart className="w-5 h-5" />} color="primary" />
        <StatCard
          title="Pending Orders"
          value={String(pendingOrders)}
          icon={<Clock className="w-5 h-5" />}
          color="yellow"
          to="/admin/orders"
        />
        <StatCard title="Sellers" value={String(sellerCount)} icon={<Users className="w-5 h-5" />} color="cyan" to="/admin/sellers" />
        <StatCard
          title="Awaiting Approval"
          value={String(pendingProducts)}
          icon={<PackageCheck className="w-5 h-5" />}
          color="purple"
          to="/admin/approval"
        />
      </div>

      {truncated && (
        <p className="text-xs text-dark-500">
          Sales and order figures are based on the latest {ROW_LIMIT.toLocaleString()} records.
        </p>
      )}

      <div className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-700">
          <h3 className="font-medium">Recent Orders</h3>
          <Link to="/admin/orders" className="text-sm text-primary-400 hover:text-primary-300">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-dark-400 text-sm text-center py-10">No orders yet.</p>
        ) : (
          <div className="divide-y divide-dark-700">
            {recent.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm truncate">{o.customer_name}</p>
                  <p className="text-xs text-dark-500">
                    #{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm">{formatPrice(Number(o.total_amount))}</p>
                  <span className={`text-xs px-2 py-0.5 rounded capitalize status-${o.status}`}>{o.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const colorClasses: Record<string, string> = {
  primary: 'bg-primary-600/20 text-primary-400',
  yellow: 'bg-yellow-500/20 text-yellow-400',
  green: 'bg-green-500/20 text-green-400',
  blue: 'bg-blue-500/20 text-blue-400',
  purple: 'bg-purple-500/20 text-purple-400',
  cyan: 'bg-cyan-500/20 text-cyan-400',
};

function StatCard({
  title, value, icon, color, to,
}: { title: string; value: string; icon: ReactNode; color: keyof typeof colorClasses; to?: string }) {
  const body = (
    <div className={`bg-dark-800/60 rounded-xl border border-dark-700/60 p-4 sm:p-5 h-full ${to ? 'hover:border-primary-500/50 transition-colors' : ''}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colorClasses[color]}`}>{icon}</div>
      <p className="text-dark-400 text-xs sm:text-sm">{title}</p>
      <p className="text-lg sm:text-2xl font-bold text-white mt-0.5 break-words">{value}</p>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}
