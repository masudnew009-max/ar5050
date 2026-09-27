import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Pencil, MapPin, X, Check } from 'lucide-react';
import { supabase, DeliveryZone } from '../../lib/supabase';
import { BD_DISTRICTS } from '../../lib/bd-districts';

export default function DeliveryZones() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [zilla, setZilla] = useState('');
  const [thana, setThana] = useState('');
  const [charge, setCharge] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCharge, setEditCharge] = useState('');

  useEffect(() => {
    loadZones();
  }, []);

  const loadZones = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('delivery_zones')
      .select('*')
      .order('zilla', { ascending: true })
      .order('thana', { ascending: true });

    if (error) setError(error.message);
    else setZones(data ?? []);
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const chargeValue = parseFloat(charge);
    if (!zilla.trim() || !thana.trim() || isNaN(chargeValue) || chargeValue < 0) {
      setError('Please fill in Zilla, Thana, and a valid delivery charge');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('delivery_zones').insert({
      zilla: zilla.trim(),
      thana: thana.trim(),
      delivery_charge: chargeValue,
    });

    if (error) {
      setError(error.message.includes('duplicate') ? 'This Zilla/Thana combination already exists' : error.message);
    } else {
      setZilla('');
      setThana('');
      setCharge('');
      await loadZones();
    }
    setSubmitting(false);
  };

  const startEdit = (zone: DeliveryZone) => {
    setEditingId(zone.id);
    setEditCharge(String(zone.delivery_charge));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditCharge('');
  };

  const saveEdit = async (id: string) => {
    const chargeValue = parseFloat(editCharge);
    if (isNaN(chargeValue) || chargeValue < 0) {
      setError('Please enter a valid delivery charge');
      return;
    }
    const { error } = await supabase
      .from('delivery_zones')
      .update({ delivery_charge: chargeValue, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) setError(error.message);
    else {
      cancelEdit();
      await loadZones();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this delivery zone?')) return;
    const { error } = await supabase.from('delivery_zones').delete().eq('id', id);
    if (error) setError(error.message);
    else await loadZones();
  };

  return (
    <div className="max-w-2xl space-y-6">
      <form onSubmit={handleAdd} className="bg-dark-800 border border-dark-700 rounded-2xl p-6 space-y-4">
        <h3 className="text-white font-medium flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary-400" />
          Add Delivery Zone
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-dark-400 mb-1">Zilla</label>
            <input
              list="bd-districts"
              value={zilla}
              onChange={(e) => setZilla(e.target.value)}
              className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g. Jashore"
            />
            <datalist id="bd-districts">
              {BD_DISTRICTS.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-xs text-dark-400 mb-1">Thana</label>
            <input
              value={thana}
              onChange={(e) => setThana(e.target.value)}
              className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g. Manirampur"
            />
          </div>
          <div>
            <label className="block text-xs text-dark-400 mb-1">Delivery Charge (৳)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={charge}
              onChange={(e) => setCharge(e.target.value)}
              className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g. 60"
            />
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add Zone
        </button>
      </form>

      <div className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-dark-700 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary-400" />
          <h3 className="text-white font-medium">Delivery Zones ({zones.length})</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
          </div>
        ) : zones.length === 0 ? (
          <p className="text-dark-400 text-sm text-center py-8">No delivery zones configured yet.</p>
        ) : (
          <div className="divide-y divide-dark-700">
            {zones.map((zone) => (
              <div key={zone.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="text-white text-sm font-medium">{zone.thana}</p>
                  <p className="text-dark-400 text-xs">{zone.zilla}</p>
                </div>

                {editingId === zone.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editCharge}
                      onChange={(e) => setEditCharge(e.target.value)}
                      className="w-24 px-2 py-1.5 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      autoFocus
                    />
                    <button onClick={() => saveEdit(zone.id)} className="p-1.5 text-primary-400 hover:bg-primary-500/10 rounded-lg">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={cancelEdit} className="p-1.5 text-dark-400 hover:bg-dark-700 rounded-lg">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-primary-400 font-medium text-sm">৳{zone.delivery_charge}</span>
                    <button onClick={() => startEdit(zone)} className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(zone.id)} className="p-1.5 text-dark-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
