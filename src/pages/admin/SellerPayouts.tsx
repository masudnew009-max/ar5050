import { useEffect, useState } from 'react';
import { Loader2, ChevronDown, ChevronUp, Phone, Trash2 } from 'lucide-react';
import { supabase, PayoutSummary, SellerPayout, PayoutAccount } from '../../lib/supabase';
import { formatPrice } from '../../lib/format';

const METHODS = ['bkash', 'nagad', 'rocket', 'bank', 'cash', 'other'];

export default function AdminSellerPayouts() {
  const [rows, setRows] = useState<PayoutSummary[]>([]);
  const [phones, setPhones] = useState<Record<string, string>>({});
  const [accounts, setAccounts] = useState<Record<string, PayoutAccount>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const [history, setHistory] = useState<SellerPayout[]>([]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bkash');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError(null);
    const [sumRes, phoneRes, acctRes] = await Promise.all([
      supabase.rpc('payout_summary'),
      supabase.from('seller_profiles').select('id, contact_phone'),
      supabase.from('seller_payout_accounts').select('*'),
    ]);
    const accMap: Record<string, PayoutAccount> = {};
    ((acctRes.data as PayoutAccount[]) ?? []).forEach((a) => (accMap[a.seller_id] = a));
    setAccounts(accMap);
    if (sumRes.error) setError(sumRes.error.message);
    else {
      const list = ((sumRes.data as PayoutSummary[]) ?? []).map((r) => ({
        ...r,
        payable: Number(r.payable),
        pending: Number(r.pending),
        paid_out: Number(r.paid_out),
        balance: Number(r.balance),
      }));
      list.sort((a, b) => b.balance - a.balance);
      setRows(list);
    }
    const map: Record<string, string> = {};
    ((phoneRes.data as { id: string; contact_phone: string | null }[]) ?? []).forEach((s) => {
      if (s.contact_phone) map[s.id] = s.contact_phone;
    });
    setPhones(map);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const loadHistory = async (sellerId: string) => {
    const { data } = await supabase
      .from('seller_payouts')
      .select('*')
      .eq('seller_id', sellerId)
      .order('paid_at', { ascending: false });
    setHistory((data as SellerPayout[]) ?? []);
  };

  const toggle = async (r: PayoutSummary) => {
    if (openId === r.seller_id) {
      setOpenId(null);
      return;
    }
    setOpenId(r.seller_id);
    setAmount(r.balance > 0 ? String(r.balance) : '');
    if (accounts[r.seller_id]) setMethod(accounts[r.seller_id].method);
    setReference('');
    setNote('');
    setHistory([]);
    await loadHistory(r.seller_id);
  };

  const pay = async (r: PayoutSummary) => {
    setError(null);
    const value = Number(amount);
    if (!value || value <= 0) return setError('Enter an amount greater than zero.');
    setBusy(true);
    const { error: err } = await supabase.rpc('record_payout', {
      p_seller_id: r.seller_id,
      p_amount: value,
      p_method: method,
      p_reference: reference,
      p_note: note,
    });
    setBusy(false);
    if (err) return setError(err.message);
    await Promise.all([load(), loadHistory(r.seller_id)]);
    setAmount('');
    setReference('');
    setNote('');
  };

  const undo = async (r: PayoutSummary, p: SellerPayout) => {
    if (!confirm(`Delete this ${formatPrice(Number(p.amount))} payout record?\n\nThe amount goes back into the seller's balance. Use only to fix a mistake.`)) return;
    const { error: err } = await supabase.from('seller_payouts').delete().eq('id', p.id);
    if (err) return setError(err.message);
    await Promise.all([load(), loadHistory(r.seller_id)]);
  };

  const input =
    'w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-sm text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500';

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="text-white max-w-3xl">
      <h1 className="text-xl font-bold mb-1">Seller Payouts</h1>
      <p className="text-sm text-dark-400 mb-5">
        Customers pay the platform, so you owe each seller their earnings after commission. An order becomes payable
        once it is <b>Completed</b> and its payment is marked <b>Paid</b> (for Cash on Delivery, mark it Paid after the
        courier's cash reaches you). Send the money yourself, then record it here.
      </p>

      {error && <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}

      {rows.length === 0 ? (
        <p className="text-dark-400 text-sm">No sellers yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const open = openId === r.seller_id;
            return (
              <div key={r.seller_id} className="bg-dark-800 border border-dark-700 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{r.shop_name}</p>
                    {accounts[r.seller_id] ? (
                      <p className="text-xs text-primary-300 mt-0.5 select-all">
                        <span className="uppercase">{accounts[r.seller_id].method}</span>: {accounts[r.seller_id].account_number}
                        {accounts[r.seller_id].account_name ? ` (${accounts[r.seller_id].account_name})` : ''}
                        {accounts[r.seller_id].bank_details ? ` · ${accounts[r.seller_id].bank_details}` : ''}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-300/80 mt-0.5">No payout account added yet</p>
                    )}
                    {phones[r.seller_id] && (
                      <p className="text-xs text-dark-400 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" /> {phones[r.seller_id]}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-dark-500">Owed now</p>
                    <p className={`text-lg font-bold ${r.balance > 0 ? 'text-green-400' : 'text-dark-300'}`}>{formatPrice(r.balance)}</p>
                  </div>
                </div>
                <p className="text-xs text-dark-500 mt-2">
                  Pending {formatPrice(r.pending)} · Paid out {formatPrice(r.paid_out)}
                </p>

                <button onClick={() => toggle(r)} className="mt-3 flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300">
                  {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {open ? 'Close' : 'Record payout / history'}
                </button>

                {open && (
                  <div className="mt-3 pt-3 border-t border-dark-700 space-y-4">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-dark-400 mb-1">Amount (৳)</label>
                        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={input} />
                      </div>
                      <div>
                        <label className="block text-xs text-dark-400 mb-1">Sent by</label>
                        <select value={method} onChange={(e) => setMethod(e.target.value)} className={input}>
                          {METHODS.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-dark-400 mb-1">Reference / TrxID (optional)</label>
                        <input value={reference} onChange={(e) => setReference(e.target.value)} className={input} />
                      </div>
                      <div>
                        <label className="block text-xs text-dark-400 mb-1">Note (optional)</label>
                        <input value={note} onChange={(e) => setNote(e.target.value)} className={input} />
                      </div>
                    </div>
                    <button
                      onClick={() => pay(r)}
                      disabled={busy || r.balance <= 0}
                      className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium"
                    >
                      {busy && <Loader2 className="w-4 h-4 animate-spin" />} Record payout
                    </button>

                    {history.length > 0 && (
                      <div className="divide-y divide-dark-700 border border-dark-700 rounded-xl">
                        {history.map((p) => (
                          <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                            <div className="min-w-0">
                              <p className="uppercase">{p.method} · {formatPrice(Number(p.amount))}</p>
                              <p className="text-xs text-dark-500">
                                {new Date(p.paid_at).toLocaleString()}
                                {p.reference ? ` · Ref ${p.reference}` : ''}
                                {p.note ? ` · ${p.note}` : ''}
                              </p>
                            </div>
                            <button onClick={() => undo(r, p)} className="p-2 text-dark-500 hover:text-red-400" aria-label="Delete payout record">
                              <Trash2 className="w-4 h-4" />
                            </button>
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
