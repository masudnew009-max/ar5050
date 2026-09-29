import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Save, CheckCircle2 } from 'lucide-react';
import { supabase, PaymentMethodConfig } from '../../lib/supabase';

type Draft = Omit<PaymentMethodConfig, 'id'> & { id?: string };

const blank = (order: number): Draft => ({
  code: '',
  name: '',
  kind: 'mobile',
  account_name: '',
  account_number: '',
  extra: '',
  instructions: '',
  is_active: false,
  sort_order: order,
});

const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);

export default function PaymentSettings() {
  const [rows, setRows] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error: err } = await supabase.from('payment_methods').select('*').order('sort_order');
    if (err) setError(err.message);
    else setRows((data as PaymentMethodConfig[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const patch = (i: number, change: Partial<Draft>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...change } : r)));

  const save = async (i: number) => {
    const r = rows[i];
    setError(null);
    if (!r.name.trim()) return setError('Give the method a name.');
    const code = r.id ? r.code : slug(r.code || r.name);
    if (code.length < 2) return setError('Code must be at least 2 letters/numbers.');
    if (r.is_active && !r.account_number.trim()) {
      return setError('Add the account number before turning a method on.');
    }
    const key = r.id ?? `new-${i}`;
    setBusyKey(key);
    const payload = {
      code,
      name: r.name.trim(),
      kind: r.kind,
      account_name: r.account_name?.trim() || null,
      account_number: r.account_number.trim(),
      extra: r.extra?.trim() || null,
      instructions: r.instructions?.trim() || null,
      is_active: r.is_active,
      sort_order: r.sort_order,
      updated_at: new Date().toISOString(),
    };
    const { error: err } = r.id
      ? await supabase.from('payment_methods').update(payload).eq('id', r.id)
      : await supabase.from('payment_methods').insert(payload);
    setBusyKey(null);
    if (err) {
      setError(err.message.includes('duplicate') ? 'A method with this code already exists.' : err.message);
      return;
    }
    setSavedKey(key);
    setTimeout(() => setSavedKey(null), 1800);
    if (!r.id) await load();
  };

  const remove = async (i: number) => {
    const r = rows[i];
    if (!r.id) return setRows((prev) => prev.filter((_, idx) => idx !== i));
    if (!confirm(`Delete "${r.name}"?\n\nExisting orders keep their payment record.`)) return;
    setBusyKey(r.id);
    const { error: err } = await supabase.from('payment_methods').delete().eq('id', r.id);
    setBusyKey(null);
    if (err) setError(err.message);
    else setRows((prev) => prev.filter((_, idx) => idx !== i));
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
      <h1 className="text-xl font-bold mb-1">Payment Methods</h1>
      <p className="text-sm text-dark-400 mb-5">
        Customers pay to these platform accounts and enter their Transaction ID at checkout. You then verify each
        payment under Orders. A method appears at checkout only when it is switched on. Cash on Delivery is always
        available.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
      )}

      <div className="space-y-4">
        {rows.map((r, i) => {
          const key = r.id ?? `new-${i}`;
          return (
            <div key={key} className="bg-dark-800 border border-dark-700 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{r.name || 'New method'}</p>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={r.is_active} onChange={(e) => patch(i, { is_active: e.target.checked })} />
                  <span className={r.is_active ? 'text-primary-300' : 'text-dark-400'}>{r.is_active ? 'On' : 'Off'}</span>
                </label>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-dark-400 mb-1">Name shown to customers</label>
                  <input value={r.name} onChange={(e) => patch(i, { name: e.target.value })} className={input} placeholder="bKash" />
                </div>
                <div>
                  <label className="block text-xs text-dark-400 mb-1">Type</label>
                  <select value={r.kind} onChange={(e) => patch(i, { kind: e.target.value as 'mobile' | 'bank' })} className={input}>
                    <option value="mobile">Mobile wallet</option>
                    <option value="bank">Bank account</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-dark-400 mb-1">{r.kind === 'bank' ? 'Account number' : 'Wallet number'}</label>
                  <input value={r.account_number} onChange={(e) => patch(i, { account_number: e.target.value })} className={input} placeholder="01XXXXXXXXX" />
                </div>
                <div>
                  <label className="block text-xs text-dark-400 mb-1">Account name</label>
                  <input value={r.account_name ?? ''} onChange={(e) => patch(i, { account_name: e.target.value })} className={input} />
                </div>
              </div>

              {r.kind === 'bank' && (
                <div>
                  <label className="block text-xs text-dark-400 mb-1">Bank, branch, routing (shown as written)</label>
                  <textarea value={r.extra ?? ''} onChange={(e) => patch(i, { extra: e.target.value })} rows={2} className={input} />
                </div>
              )}

              <div>
                <label className="block text-xs text-dark-400 mb-1">Instructions for the customer</label>
                <textarea value={r.instructions ?? ''} onChange={(e) => patch(i, { instructions: e.target.value })} rows={2} className={input} />
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <button onClick={() => remove(i)} disabled={busyKey === key} className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 disabled:opacity-50">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
                <button
                  onClick={() => save(i)}
                  disabled={busyKey === key}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-lg text-sm font-medium"
                >
                  {busyKey === key ? <Loader2 className="w-4 h-4 animate-spin" /> : savedKey === key ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {savedKey === key ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => setRows((prev) => [...prev, blank((prev[prev.length - 1]?.sort_order ?? 0) + 1)])}
        className="mt-4 flex items-center gap-2 px-4 py-2 border border-dashed border-dark-600 hover:border-primary-600 rounded-xl text-sm text-dark-300 hover:text-white"
      >
        <Plus className="w-4 h-4" /> Add payment method
      </button>
    </div>
  );
}
