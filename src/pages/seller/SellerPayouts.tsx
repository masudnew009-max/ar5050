import { useEffect, useState } from 'react';
import { Loader2, Wallet, Clock, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, PayoutSummary, SellerPayout, PayoutAccount } from '../../lib/supabase';
import { formatPrice } from '../../lib/format';

/** Seller-facing view of what the platform owes them and what has been paid (Phase 17b). */
export default function SellerPayouts() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [payouts, setPayouts] = useState<SellerPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [acctMethod, setAcctMethod] = useState<PayoutAccount['method']>('bkash');
  const [acctNumber, setAcctNumber] = useState('');
  const [acctName, setAcctName] = useState('');
  const [acctBank, setAcctBank] = useState('');
  const [acctSaving, setAcctSaving] = useState(false);
  const [acctSaved, setAcctSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [sumRes, payRes, acctRes] = await Promise.all([
        supabase.rpc('payout_summary'),
        supabase.from('seller_payouts').select('*').eq('seller_id', user.id).order('paid_at', { ascending: false }),
        supabase.from('seller_payout_accounts').select('*').eq('seller_id', user.id).maybeSingle(),
      ]);
      const acct = acctRes.data as PayoutAccount | null;
      if (acct) {
        setAcctMethod(acct.method);
        setAcctNumber(acct.account_number);
        setAcctName(acct.account_name ?? '');
        setAcctBank(acct.bank_details ?? '');
      }
      if (sumRes.error) setError(sumRes.error.message);
      else setSummary(((sumRes.data as PayoutSummary[]) ?? [])[0] ?? null);
      setPayouts((payRes.data as SellerPayout[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const saveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    if (!acctNumber.trim()) return setError('Enter your account number.');
    setAcctSaving(true);
    const { error: err } = await supabase.from('seller_payout_accounts').upsert({
      seller_id: user.id,
      method: acctMethod,
      account_number: acctNumber.trim(),
      account_name: acctName.trim() || null,
      bank_details: acctMethod === 'bank' ? acctBank.trim() || null : null,
      updated_at: new Date().toISOString(),
    });
    setAcctSaving(false);
    if (err) return setError(err.message);
    setAcctSaved(true);
    setTimeout(() => setAcctSaved(false), 2000);
  };

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

      <form onSubmit={saveAccount} className="bg-dark-800 border border-dark-700 rounded-2xl p-5 space-y-3">
        <div>
          <h3 className="text-white font-medium">Where should we send your money?</h3>
          <p className="text-xs text-dark-500">Only you and the marketplace admin can see this.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <select
            value={acctMethod}
            onChange={(e) => setAcctMethod(e.target.value as PayoutAccount['method'])}
            className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-sm text-white"
          >
            <option value="bkash">bKash</option>
            <option value="nagad">Nagad</option>
            <option value="rocket">Rocket</option>
            <option value="bank">Bank account</option>
          </select>
          <input
            value={acctNumber}
            onChange={(e) => setAcctNumber(e.target.value)}
            placeholder={acctMethod === 'bank' ? 'Account number' : 'Wallet number (01XXXXXXXXX)'}
            className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-sm text-white placeholder-dark-500"
          />
          <input
            value={acctName}
            onChange={(e) => setAcctName(e.target.value)}
            placeholder="Account holder name"
            className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-sm text-white placeholder-dark-500"
          />
          {acctMethod === 'bank' && (
            <input
              value={acctBank}
              onChange={(e) => setAcctBank(e.target.value)}
              placeholder="Bank name, branch"
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-sm text-white placeholder-dark-500"
            />
          )}
        </div>
        <button
          type="submit"
          disabled={acctSaving}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white"
        >
          {acctSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : acctSaved ? <CheckCircle2 className="w-4 h-4" /> : null}
          {acctSaved ? 'Saved' : 'Save account'}
        </button>
      </form>

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
