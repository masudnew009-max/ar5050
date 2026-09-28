import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ClipboardList } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Order } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { formatPrice } from '../../lib/format';

export default function MyOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('orders')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOrders((data as Order[]) ?? []);
        setLoading(false);
      });
  }, [user]);

  return (
    <div className="text-white max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">My orders</h1>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-dark-400">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 text-dark-500" />
          <p className="mb-3">You haven't placed any orders yet.</p>
          <Link to="/shop" className="text-primary-400 hover:text-primary-300">Start shopping</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Link
              key={o.id}
              to={`/orders/${o.id}`}
              className="flex items-center justify-between bg-dark-800/60 border border-dark-700 hover:border-primary-600/50 rounded-2xl p-4 transition-colors"
            >
              <div>
                <p className="font-mono font-semibold">#{o.id.slice(0, 8).toUpperCase()}</p>
                <p className="text-xs text-dark-400">{new Date(o.created_at).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-primary-400">{formatPrice(o.total_amount)}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize status-${o.status}`}>{o.status}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
