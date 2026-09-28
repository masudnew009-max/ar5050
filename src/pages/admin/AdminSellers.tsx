import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Store, Phone, MapPin, Ban, CheckCircle2, Package } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SellerRow {
  id: string;
  shop_name: string;
  shop_slug: string;
  contact_phone: string | null;
  address: string | null;
  created_at: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  productCount: number;
}

type ProfileEmbed = { email: string; full_name: string | null; is_active: boolean };

interface RawSeller {
  id: string;
  shop_name: string;
  shop_slug: string;
  contact_phone: string | null;
  address: string | null;
  created_at: string;
  profiles: ProfileEmbed | ProfileEmbed[] | null;
}

export default function AdminSellers() {
  const [sellers, setSellers] = useState<SellerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);

    const [sellersRes, productsRes] = await Promise.all([
      supabase
        .from('seller_profiles')
        .select('id, shop_name, shop_slug, contact_phone, address, created_at, profiles(email, full_name, is_active)')
        .order('created_at', { ascending: false }),
      supabase.from('products').select('seller_id'),
    ]);

    if (sellersRes.error) {
      setError(sellersRes.error.message);
      setLoading(false);
      return;
    }

    const counts: Record<string, number> = {};
    (productsRes.data ?? []).forEach((p: { seller_id: string }) => {
      counts[p.seller_id] = (counts[p.seller_id] ?? 0) + 1;
    });

    const rows: SellerRow[] = ((sellersRes.data ?? []) as unknown as RawSeller[]).map((row) => {
      const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return {
        id: row.id,
        shop_name: row.shop_name,
        shop_slug: row.shop_slug,
        contact_phone: row.contact_phone,
        address: row.address,
        created_at: row.created_at,
        email: p?.email ?? '',
        full_name: p?.full_name ?? null,
        is_active: p?.is_active ?? true,
        productCount: counts[row.id] ?? 0,
      };
    });

    setSellers(rows);
    setLoading(false);
  };

  const toggleBlock = async (seller: SellerRow) => {
    const blocking = seller.is_active;
    const message = blocking
      ? `Block "${seller.shop_name}"?\n\nTheir products and reels will disappear from the shop and they won't be able to add or edit products.`
      : `Unblock "${seller.shop_name}"?`;
    if (!confirm(message)) return;

    setActingId(seller.id);
    setError(null);
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: !seller.is_active })
      .eq('id', seller.id);

    if (error) setError(error.message);
    else setSellers((prev) => prev.map((s) => (s.id === seller.id ? { ...s, is_active: !s.is_active } : s)));
    setActingId(null);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sellers;
    return sellers.filter((s) =>
      [s.shop_name, s.shop_slug, s.email, s.full_name ?? '', s.contact_phone ?? '']
        .some((v) => v.toLowerCase().includes(q))
    );
  }, [sellers, query]);

  const blockedCount = sellers.filter((s) => !s.is_active).length;

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

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-dark-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search shop, owner, email or phone"
            className="w-full pl-9 pr-3 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-sm text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <p className="text-sm text-dark-400 whitespace-nowrap">
          {sellers.length} seller{sellers.length === 1 ? '' : 's'}
          {blockedCount > 0 && <span className="text-red-400"> · {blockedCount} blocked</span>}
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="text-dark-400 text-sm text-center py-12 bg-dark-800 border border-dark-700 rounded-2xl">
          {sellers.length === 0 ? 'No sellers have registered yet.' : 'No sellers match your search.'}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <div key={s.id} className="bg-dark-800 border border-dark-700 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Store className="w-4 h-4 text-primary-400 flex-shrink-0" />
                    <p className="font-medium truncate">{s.shop_name}</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        s.is_active ? 'status-approved' : 'status-rejected'
                      }`}
                    >
                      {s.is_active ? 'Active' : 'Blocked'}
                    </span>
                  </div>
                  <p className="text-xs text-dark-500 mt-0.5">/{s.shop_slug}</p>
                </div>

                <button
                  onClick={() => toggleBlock(s)}
                  disabled={actingId === s.id}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all disabled:opacity-50 flex-shrink-0 ${
                    s.is_active
                      ? 'bg-dark-700 hover:bg-red-500/20 text-dark-300 hover:text-red-400'
                      : 'bg-primary-600 hover:bg-primary-700 text-white'
                  }`}
                >
                  {actingId === s.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : s.is_active ? (
                    <Ban className="w-4 h-4" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {s.is_active ? 'Block' : 'Unblock'}
                </button>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-dark-300">
                <p className="truncate">
                  {s.full_name || 'No name'} · <span className="text-dark-400">{s.email}</span>
                </p>
                {s.contact_phone && (
                  <p className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-dark-500" />
                    {s.contact_phone}
                  </p>
                )}
                {s.address && (
                  <p className="flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-dark-500 flex-shrink-0" />
                    <span className="truncate">{s.address}</span>
                  </p>
                )}
                <p className="flex items-center gap-1.5 text-dark-400">
                  <Package className="w-3.5 h-3.5 text-dark-500" />
                  {s.productCount} product{s.productCount === 1 ? '' : 's'} · joined{' '}
                  {new Date(s.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
