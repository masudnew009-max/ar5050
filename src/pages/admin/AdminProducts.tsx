import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Search, Package, Eye, EyeOff, Trash2, Store } from 'lucide-react';
import { supabase, Product, ProductStatus } from '../../lib/supabase';
import { formatPrice } from '../../lib/format';

type Filter = 'all' | ProductStatus;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [shopNames, setShopNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);

    const [productsRes, sellersRes] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('seller_profiles').select('id, shop_name'),
    ]);

    if (productsRes.error) setError(productsRes.error.message);
    setProducts((productsRes.data ?? []) as Product[]);

    const map: Record<string, string> = {};
    (sellersRes.data ?? []).forEach((s: { id: string; shop_name: string }) => {
      map[s.id] = s.shop_name;
    });
    setShopNames(map);
    setLoading(false);
  };

  const toggleActive = async (product: Product) => {
    setError(null);
    const { error } = await supabase
      .from('products')
      .update({ is_active: !product.is_active })
      .eq('id', product.id);
    if (error) setError(error.message);
    else setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, is_active: !p.is_active } : p)));
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    setError(null);
    const { error } = await supabase.from('products').delete().eq('id', product.id);
    if (error) {
      // 23503 = foreign key violation: the product already appears in an order
      setError(
        error.code === '23503'
          ? `"${product.name}" is part of existing orders and can't be deleted. Hide it instead.`
          : error.message
      );
    } else {
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
    }
  };

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: products.length, pending: 0, approved: 0, rejected: 0 };
    products.forEach((p) => {
      c[p.status] += 1;
    });
    return c;
  }, [products]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (filter !== 'all' && p.status !== filter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q) ||
        (shopNames[p.seller_id] ?? '').toLowerCase().includes(q)
      );
    });
  }, [products, filter, query, shopNames]);

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

      <div className="relative">
        <Search className="w-4 h-4 text-dark-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search product, category or shop"
          className="w-full pl-9 pr-3 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-sm text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
              filter === f.id ? 'bg-primary-600 text-white' : 'bg-dark-800 text-dark-300 hover:text-white'
            }`}
          >
            {f.label} <span className="opacity-70">({counts[f.id]})</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-dark-400 text-sm text-center py-12 bg-dark-800 border border-dark-700 rounded-2xl">
          No products found.
        </p>
      ) : (
        <div className="bg-dark-800 border border-dark-700 rounded-2xl divide-y divide-dark-700 overflow-hidden">
          {visible.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-12 h-12 rounded-lg bg-dark-700 flex-shrink-0 overflow-hidden flex items-center justify-center">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-5 h-5 text-dark-500" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded capitalize status-${p.status}`}>{p.status}</span>
                  {p.status === 'approved' && !p.is_active && (
                    <span className="text-xs px-2 py-0.5 rounded bg-dark-700 text-dark-400">Hidden</span>
                  )}
                </div>
                <p className="text-xs text-dark-400 mt-0.5 flex items-center gap-1 flex-wrap">
                  <Store className="w-3 h-3" />
                  {shopNames[p.seller_id] || 'Unknown shop'} · {formatPrice(Number(p.price))} · Stock {p.stock}
                  {p.category ? ` · ${p.category}` : ''}
                </p>
                {p.status === 'rejected' && p.rejection_reason && (
                  <p className="text-xs text-red-400 mt-0.5">Reason: {p.rejection_reason}</p>
                )}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {p.status === 'pending' && (
                  <Link
                    to="/admin/approval"
                    className="px-2.5 py-1.5 text-xs rounded-lg bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25"
                  >
                    Review
                  </Link>
                )}
                {p.status === 'approved' && (
                  <button
                    onClick={() => toggleActive(p)}
                    title={p.is_active ? 'Hide from shop' : 'Show in shop'}
                    className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg"
                  >
                    {p.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                )}
                <button
                  onClick={() => handleDelete(p)}
                  title="Delete"
                  className="p-2 text-dark-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
