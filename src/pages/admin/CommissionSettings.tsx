import { useEffect, useState } from 'react';
import { Loader2, Percent, Coins, CheckCircle2 } from 'lucide-react';
import { supabase, CommissionSettings as CommissionSettingsType, CommissionType } from '../../lib/supabase';

export default function CommissionSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [commissionType, setCommissionType] = useState<CommissionType>('percentage');
  const [commissionValue, setCommissionValue] = useState('0');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('commission_settings')
      .select('*')
      .eq('id', true)
      .maybeSingle<CommissionSettingsType>();

    if (error) {
      setError(error.message);
    } else if (data) {
      setCommissionType(data.commission_type);
      setCommissionValue(String(data.commission_value));
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const value = parseFloat(commissionValue);
    if (isNaN(value) || value < 0) {
      setError('Please enter a valid non-negative number');
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from('commission_settings')
      .update({
        commission_type: commissionType,
        commission_value: value,
        updated_at: new Date().toISOString(),
      })
      .eq('id', true);

    if (error) {
      setError(error.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  const exampleSubtotal = 500;
  const parsedValue = parseFloat(commissionValue) || 0;
  const exampleCommission =
    commissionType === 'percentage' ? (exampleSubtotal * parsedValue) / 100 : parsedValue;
  const exampleNet = exampleSubtotal - exampleCommission;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <form onSubmit={handleSave} className="bg-dark-800 border border-dark-700 rounded-2xl p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-dark-300 mb-3">Commission Type</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setCommissionType('percentage')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl border transition-all ${
                commissionType === 'percentage'
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'bg-dark-700 border-dark-600 text-dark-300 hover:text-white'
              }`}
            >
              <Percent className="w-4 h-4" />
              Percentage
            </button>
            <button
              type="button"
              onClick={() => setCommissionType('fixed')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl border transition-all ${
                commissionType === 'fixed'
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'bg-dark-700 border-dark-600 text-dark-300 hover:text-white'
              }`}
            >
              <Coins className="w-4 h-4" />
              Fixed Amount
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-300 mb-2">
            {commissionType === 'percentage' ? 'Commission (%)' : 'Commission (৳ per item)'}
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={commissionValue}
            onChange={(e) => setCommissionValue(e.target.value)}
            required
            className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="bg-dark-900 border border-dark-700 rounded-xl p-4 text-sm">
          <p className="text-dark-400 mb-1">Example: on a ৳{exampleSubtotal} sale</p>
          <p className="text-white">
            Platform commission: <span className="text-red-400">৳{exampleCommission.toFixed(2)}</span>
          </p>
          <p className="text-white">
            Seller receives: <span className="text-primary-400">৳{exampleNet.toFixed(2)}</span>
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-5 h-5 animate-spin" />}
          {saved && !saving && <CheckCircle2 className="w-5 h-5" />}
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save Commission Settings'}
        </button>
      </form>
    </div>
  );
}
