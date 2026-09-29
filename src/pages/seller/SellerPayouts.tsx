import { useEffect, useState } from 'react';
import { Loader2, Wallet, Clock, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, PayoutSummary, SellerPayout } from '../../lib/supabase';
import { formatPrice } from '../../lib/format';

/** Seller-facing view of what the platform owes them and what has been paid (Phase 17b). */
export default function SellerPayouts() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [payouts, setPayouts] = useState<SellerPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [sumRes, payRes] = await Promise.all([
        supabase.rpc('payout_summary'),
        supabase.from('seller_payouts').select('*').eq('seller_id', user.id).order('paid_at', { ascending: false }),
      ]);
      if (sumRes.error) setError(sumRes.error.message);
      else setSummary(((sumRes.data as PayoutSummary[]) ?? [])[0] ?? null);
      setPayouts((payRes.data as SellerPayout[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  const card = 'bg-dark-800/50 rounded-xl border border-dark-700/50 p-5';

  return (
    <div className="space-y-6">
      {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={card}>
          <p className="flex items-center gap-2 text-sm text-dark-400"><Wallet className="w-4 h-4 text-green-400" /> Available to be paid</p>
          <p className="text-2xl font-bold mt-1 text-green-400">{formatPrice(Number(summary?.balance ?? 0))}</p>
        </div>
        <div className={card}>
          <p className="flex items-center gap-2 text-sm text-dark-400"><Clock className="w-4 h-4 text-yellow-400" /> Pending</p>
          <p className="text-2xl font-bold mt-1">{formatPrice(Number(summary?.pending ?? 0))}</p>
        </div>
        <div className={card}>
          <p className="flex items-center gap-2 text-sm text-dark-400"><ArrowUpRight className="w-4 h-4 text-primary-400" /> Paid out so far</p>
          <p className="text-2xl font-bold mt-1">{formatPrice(Number(summary?.paid_out ?? 0))}</p>
        </div>
      </div>

      <p className="text-xs text-dark-500">
        Amounts are your earnings after commission. An order becomes available to be paid once it is completed and its
        payment is confirmed as paid. Pending covers orders still in progress or awaiting payment confirmation.
      </p>

      <div className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-dark-700">
          <h3 className="text-white font-medium">Payout history</h3>
        </div>
        {payouts.length === 0 ? (
          <p className="text-dark-400 text-sm text-center py-10">No payouts yet.</p>
        ) : (
          <div className="divide-y divide-dark-700">
            {payouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="text-white text-sm uppercase">{p.method}</p>
                  <p className="text-dark-500 text-xs">
                    {new Date(p.paid_at).toLocaleDateString()}
                    {p.reference ? ` · Ref ${p.reference}` : ''}
                  </p>
                  {p.note && <p className="text-dark-400 text-xs">{p.note}</p>}
                </div>
                <p className="text-green-400 font-medium">{formatPrice(Number(p.amount))}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
