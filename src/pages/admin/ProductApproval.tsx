import { useEffect, useState } from 'react';
import { Loader2, Check, X, Package, Store } from 'lucide-react';
import { supabase, Product } from '../../lib/supabase';

export default function ProductApproval() {
  const [products, setProducts] = useState<Product[]>([]);
  const [shopNames, setShopNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    loadPending();
  }, []);

  const loadPending = async () => {
    setLoading(true);
    setError(null);

    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (productsError) {
      setError(productsError.message);
      setLoading(false);
      return;
    }

    const list = productsData ?? [];
    setProducts(list);

    const sellerIds = [...new Set(list.map((p) => p.seller_id))];
    if (sellerIds.length > 0) {
      const { data: sellers } = await supabase
        .from('seller_profiles')
        .select('id, shop_name')
        .in('id', sellerIds);

      const map: Record<string, string> = {};
      (sellers ?? []).forEach((s) => {
        map[s.id] = s.shop_name;
      });
      setShopNames(map);
    }

    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    setActingId(id);
    const { error } = await supabase
      .from('products')
      .update({ status: 'approved', rejection_reason: null })
      .eq('id', id);

    if (error) setError(error.message);
    else setProducts((prev) => prev.filter((p) => p.id !== id));
    setActingId(null);
  };

  const openReject = (id: string) => {
    setRejectingId(id);
    setRejectReason('');
  };

  const confirmReject = async (id: string) => {
    if (!rejectReason.trim()) {
      setError('Please provide a reason for rejection');
      return;
    }
    setActingId(id);
    const { error } = await supabase
      .from('products')
      .update({ status: 'rejected', rejection_reason: rejectReason.trim() })
      .eq('id', id);

    if (error) setError(error.message);
    else setProducts((prev) => prev.filter((p) => p.id !== id));
    setActingId(null);
    setRejectingId(null);
    setRejectReason('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <Package className="w-4 h-4 text-primary-400" />
        <h3 className="text-white font-medium">Pending Products ({products.length})</h3>
      </div>

      {products.length === 0 ? (
        <p className="text-dark-400 text-sm text-center py-12 bg-dark-800 border border-dark-700 rounded-2xl">
          No products waiting for approval right now.
        </p>
      ) : (
        <div className="space-y-4">
          {products.map((product) => (
            <div key={product.id} className="bg-dark-800 border border-dark-700 rounded-2xl p-4">
              <div className="flex gap-4">
                <div className="w-20 h-20 rounded-xl bg-dark-700 flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-8 h-8 text-dark-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-white font-medium truncate">{product.name}</p>
                      <p className="text-xs text-dark-400 flex items-center gap-1 mt-0.5">
                        <Store className="w-3 h-3" />
                        {shopNames[product.seller_id] || 'Unknown shop'}
                      </p>
                    </div>
                    <span className="text-primary-400 font-medium whitespace-nowrap">
                      ৳{product.price}
                    </span>
                  </div>

                  {product.description && (
                    <p className="text-dark-400 text-sm mt-2 line-clamp-2">{product.description}</p>
                  )}

                  <div className="flex items-center gap-3 mt-2 text-xs text-dark-500">
                    {product.category && <span>{product.category}</span>}
                    <span>Stock: {product.stock} {product.unit}</span>
                  </div>
                </div>
              </div>

              {rejectingId === product.id ? (
                <div className="mt-4 space-y-2">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={2}
                    placeholder="Reason for rejection (visible to the seller)"
                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => confirmReject(product.id)}
                      disabled={actingId === product.id}
                      className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-all disabled:opacity-50"
                    >
                      {actingId === product.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                      Confirm Reject
                    </button>
                    <button
                      onClick={() => setRejectingId(null)}
                      className="px-3 py-2 bg-dark-700 hover:bg-dark-600 text-dark-300 text-sm rounded-lg transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleApprove(product.id)}
                    disabled={actingId === product.id}
                    className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-all disabled:opacity-50"
                  >
                    {actingId === product.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Approve
                  </button>
                  <button
                    onClick={() => openReject(product.id)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-dark-700 hover:bg-red-500/20 text-dark-300 hover:text-red-400 text-sm rounded-lg transition-all"
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
