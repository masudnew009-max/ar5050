import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2, Package, Minus, Plus, ShoppingBag, Store, ArrowLeft, Film } from 'lucide-react';
import { supabase, Product, Reel } from '../../lib/supabase';
import { formatPrice } from '../../lib/format';
import ProductCard from './ProductCard';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [shopName, setShopName] = useState<string | null>(null);
  const [reels, setReels] = useState<Reel[]>([]);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setQty(1);

    (async () => {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .eq('status', 'approved')
        .eq('is_active', true)
        .maybeSingle();

      if (cancelled) return;
      const p = data as Product | null;
      setProduct(p);

      if (p) {
        const [shopRes, reelRes, relatedRes] = await Promise.all([
          supabase.from('seller_profiles').select('shop_name').eq('id', p.seller_id).maybeSingle(),
          supabase.from('reels').select('*').eq('product_id', p.id).eq('is_active', true).limit(6),
          p.category
            ? supabase
                .from('products')
                .select('*')
                .eq('status', 'approved')
                .eq('is_active', true)
                .eq('category', p.category)
                .neq('id', p.id)
                .order('created_at', { ascending: false })
                .limit(4)
            : Promise.resolve({ data: [] as Product[] }),
        ]);
        if (cancelled) return;
        setShopName((shopRes.data as { shop_name: string } | null)?.shop_name ?? null);
        setReels((reelRes.data as Reel[]) ?? []);
        setRelated((relatedRes.data as Product[]) ?? []);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-24 text-white">
        <Package className="w-12 h-12 mx-auto mb-3 text-dark-500" />
        <p className="mb-4 text-dark-400">This product isn't available.</p>
        <Link to="/shop" className="text-primary-400 hover:text-primary-300">
          Back to shop
        </Link>
      </div>
    );
  }

  const soldOut = product.stock <= 0;
  const maxQty = Math.max(1, product.stock);

  return (
    <div className="text-white max-w-5xl mx-auto">
      <Link to="/shop" className="inline-flex items-center gap-1 text-sm text-dark-400 hover:text-white mb-4">
        <ArrowLeft className="w-4 h-4" /> Shop
      </Link>

      <div className="grid md:grid-cols-2 gap-6 lg:gap-10">
        <div className="aspect-square bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-16 h-16 text-dark-500" />
            </div>
          )}
        </div>

        <div>
          {product.category && (
            <Link
              to={`/shop?category=${encodeURIComponent(product.category)}`}
              className="text-xs px-2.5 py-1 rounded-full bg-primary-600/20 text-primary-400"
            >
              {product.category}
            </Link>
          )}
          <h1 className="text-2xl font-bold mt-3 mb-2">{product.name}</h1>
          <p className="text-3xl font-bold text-primary-400 mb-1">
            {formatPrice(product.price)}
            <span className="text-sm text-dark-400 font-normal"> / {product.unit || 'pcs'}</span>
          </p>
          {shopName && (
            <p className="flex items-center gap-1.5 text-sm text-dark-400 mb-4">
              <Store className="w-4 h-4" /> Sold by {shopName}
            </p>
          )}

          <p className={`text-sm mb-5 ${soldOut ? 'text-red-400' : 'text-dark-300'}`}>
            {soldOut ? 'Out of stock' : `${product.stock} in stock`}
          </p>

          {!soldOut && (
            <div className="flex items-center gap-3 mb-5">
              <span className="text-sm text-dark-400">Quantity</span>
              <div className="flex items-center bg-dark-800 border border-dark-700 rounded-xl">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="p-2.5 text-dark-300 hover:text-white"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-10 text-center font-medium">{qty}</span>
                <button
                  onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                  className="p-2.5 text-dark-300 hover:text-white"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <button
            disabled={soldOut}
            onClick={() => navigate(`/checkout/${product.id}?qty=${qty}`)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-dark-700 disabled:text-dark-500 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg shadow-primary-600/30 disabled:shadow-none transition-all"
          >
            <ShoppingBag className="w-5 h-5" />
            {soldOut ? 'Sold out' : 'Buy Now'}
          </button>

          {product.description && (
            <div className="mt-6 pt-6 border-t border-dark-700">
              <h2 className="font-semibold mb-2">Description</h2>
              <p className="text-dark-300 text-sm whitespace-pre-line">{product.description}</p>
            </div>
          )}
        </div>
      </div>

      {reels.length > 0 && (
        <section className="mt-10">
          <h2 className="flex items-center gap-2 font-semibold mb-3">
            <Film className="w-4 h-4 text-primary-400" /> Watch this product in action
          </h2>
          <div className="flex gap-3 overflow-x-auto no-scrollbar">
            {reels.map((r) => (
              <Link
                key={r.id}
                to={`/reels?start=${r.id}`}
                className="shrink-0 w-28 aspect-[9/16] rounded-xl overflow-hidden bg-dark-700 border border-dark-700"
              >
                {r.thumbnail_url ? (
                  <img src={r.thumbnail_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <video
                    src={`${r.video_url}#t=0.1`}
                    preload="metadata"
                    muted
                    playsInline
                    className="w-full h-full object-cover pointer-events-none"
                  />
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="font-semibold mb-3">More in {product.category}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
