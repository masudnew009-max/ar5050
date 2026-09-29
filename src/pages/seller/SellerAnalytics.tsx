import { useEffect, useState, ReactNode } from 'react';
import { ShoppingCart, Clock, Wallet, Receipt, Package } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, OrderStatus } from '../../lib/supabase';

interface ItemRow {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  subtotal: number;
  commission_amount: number;
  seller_net_amount: number;
  created_at: string;
  orders: { status: OrderStatus; created_at: string; payment_method: string; payment_status: string } | null;
}

interface Stats {
  totalOrders: number;
  pendingOrders: number;
  totalSales: number;
  totalCommission: number;
  netIncome: number;
}

/** What the seller should know about payment before shipping. */
function paymentBadge(o: ItemRow['orders']): { text: string; cls: string } | null {
  if (!o || o.status === 'cancelled') return null;
  if (o.payment_method === 'cod') return { text: 'Cash on Delivery', cls: 'bg-blue-500/15 text-blue-300' };
  if (o.payment_status === 'paid') return { text: 'Paid', cls: 'bg-green-500/15 text-green-300' };
  if (o.payment_status === 'pending_verification')
    return { text: 'Payment being verified — wait before shipping', cls: 'bg-yellow-500/15 text-yellow-300' };
  return { text: 'Payment not received — don\'t ship yet', cls: 'bg-red-500/15 text-red-300' };
}

export default function SellerAnalytics() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    pendingOrders: 0,
    totalSales: 0,
    totalCommission: 0,
    netIncome: 0,
  });
  const [recentItems, setRecentItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) loadAnalytics();
  }, [user]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('order_items')
      .select('id, order_id, product_id, quantity, subtotal, commission_amount, seller_net_amount, created_at, orders(status, created_at, payment_method, payment_status)')
      .eq('seller_id', user!.id)
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const items = (data ?? []) as unknown as ItemRow[];
    const nonCancelled = items.filter((i) => i.orders?.status !== 'cancelled');

    const orderIds = new Set(nonCancelled.map((i) => i.order_id));
    const pendingOrderIds = new Set(
      items.filter((i) => i.orders?.status === 'pending').map((i) => i.order_id)
    );

    setStats({
      totalOrders: orderIds.size,
      pendingOrders: pendingOrderIds.size,
      totalSales: nonCancelled.reduce((sum, i) => sum + Number(i.subtotal), 0),
      totalCommission: nonCancelled.reduce((sum, i) => sum + Number(i.commission_amount), 0),
      netIncome: nonCancelled.reduce((sum, i) => sum + Number(i.seller_net_amount), 0),
    });

    setRecentItems(items.slice(0, 8));
    setLoading(false);
  };

  const formatCurrency = (amount: number) => `৳${amount.toFixed(2)}`;

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="animate-pulse bg-dark-800 rounded-xl h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Orders" value={stats.totalOrders.toString()} icon={<ShoppingCart className="w-6 h-6" />} color="primary" />
        <StatCard title="Pending Orders" value={stats.pendingOrders.toString()} icon={<Clock className="w-6 h-6" />} color="yellow" />
        <StatCard title="Total Sales" value={formatCurrency(stats.totalSales)} icon={<Receipt className="w-6 h-6" />} color="blue" />
        <StatCard title="Net Income (after commission)" value={formatCurrency(stats.netIncome)} icon={<Wallet className="w-6 h-6" />} color="green" />
      </div>

      <div className="bg-dark-800/50 rounded-xl border border-dark-700/50 p-4 text-sm text-dark-400 flex items-center justify-between">
        <span>Total platform commission deducted so far</span>
        <span className="text-red-400 font-medium">{formatCurrency(stats.totalCommission)}</span>
      </div>

      <div className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-dark-700">
          <h3 className="text-white font-medium">Recent Sales</h3>
        </div>

        {recentItems.length === 0 ? (
          <p className="text-dark-400 text-sm text-center py-10">
            No sales yet. Once customers start ordering your products, they'll show up here.
          </p>
        ) : (
          <div className="divide-y divide-dark-700">
            {recentItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-dark-700 flex items-center justify-center">
                    <Package className="w-4 h-4 text-dark-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm">Qty {item.quantity}</p>
                    <p className="text-dark-500 text-xs">
                      {new Date(item.created_at).toLocaleDateString()} · {item.orders?.status ?? 'unknown'}
                    </p>
                    {(() => {
                      const b = paymentBadge(item.orders);
                      return b ? <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${b.cls}`}>{b.text}</span> : null;
                    })()}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white text-sm">{formatCurrency(Number(item.subtotal))}</p>
                  <p className="text-primary-400 text-xs">Net {formatCurrency(Number(item.seller_net_amount))}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  color: 'primary' | 'yellow' | 'green' | 'blue' | 'purple' | 'cyan';
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  const colorClasses: Record<string, string> = {
    primary: 'bg-primary-600/20 text-primary-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
    green: 'bg-green-500/20 text-green-400',
    blue: 'bg-blue-500/20 text-blue-400',
    purple: 'bg-purple-500/20 text-purple-400',
    cyan: 'bg-cyan-500/20 text-cyan-400',
  };

  return (
    <div className="bg-dark-800/50 rounded-xl border border-dark-700/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
      <p className="text-dark-400 text-sm">{title}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}
