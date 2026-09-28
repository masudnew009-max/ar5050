import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Loader2, Film, Play, PackageSearch } from 'lucide-react';
import { supabase, Product, ReelWithProduct } from '../../lib/supabase';
import { PRODUCT_CATEGORIES } from '../../lib/categories';
import ProductCard from './ProductCard';

const PAGE_SIZE = 24;
type Sort = 'newest' | 'price_asc' | 'price_desc';

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('category') || 'All';
  const urlQuery = searchParams.get('q') || '';

  const [searchInput, setSearchInput] = useState(urlQuery);
  const [sort, setSort] = useState<Sort>('newest');

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reels, setReels] = useState<ReelWithProduct[]>([]);
  const requestId = useRef(0);

  const updateParams = (next: { category?: string; q?: string }) => {
    const params = new URLSearchParams(searchParams);
    if (next.category !== undefined) {
      if (next.category === 'All') params.delete('category');
      else params.set('category', next.category);
    }
    if (next.q !== undefined) {
      if (next.q) params.set('q', next.q);
      else params.delete('q');
    }
    setSearchParams(params, { replace: true });
  };

  // Debounce the search box into the URL
  useEffect(() => {
    if (searchInput === urlQuery) return;
    const t = setTimeout(() => updateParams({ q: searchInput.trim() }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const fetchProducts = async (offset: number) => {
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('status', 'approved')
      .eq('is_active', true);

    if (category !== 'All') query = query.eq('category', category);
    if (urlQuery) query = query.ilike('name', `%${urlQuery}%`);

    if (sort === 'price_asc') query = query.order('price', { ascending: true });
    else if (sort === 'price_desc') query = query.order('price', { ascending: false });
    else query = query.order('created_at', { ascending: false });

    return query.range(offset, offset + PAGE_SIZE - 1);
  };

  // (Re)load first page whenever filters change
  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    fetchProducts(0).then(({ data, count, error: err }) => {
      if (id !== requestId.current) return;
      if (err) {
        setError(err.message);
        setProducts([]);
        setTotal(0);
      } else {
        setProducts((data as Product[]) ?? []);
        setTotal(count ?? 0);
      }
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, urlQuery, sort]);

  const loadMore = async () => {
    setLoadingMore(true);
    const { data, error: err } = await fetchProducts(products.length);
    if (err) setError(err.message);
    else setProducts((prev) => [...prev, ...((data as Product[]) ?? [])]);
    setLoadingMore(false);
  };

  // Reels teaser strip
  useEffect(() => {
    supabase
      .from('reels')
      .select('*, product:products(*)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(12)
      .then(({ data }) => setReels(((data as ReelWithProduct[]) ?? []).filter((r) => r.product)));
  }, []);

  const categories = ['All', ...PRODUCT_CATEGORIES];

  return (
    <div className="text-white max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Shop</h1>

      {/* Reels strip */}
      {reels.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="flex items-center gap-2 font-semibold">
              <Film className="w-4 h-4 text-primary-400" /> Shop from reels
            </h2>
            <Link to="/reels" className="text-sm text-primary-400 hover:text-primary-300">
              Watch all
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {reels.map((r) => (
              <Link
                key={r.id}
                to={`/reels?start=${r.id}`}
                className="relative shrink-0 w-28 aspect-[9/16] rounded-xl overflow-hidden bg-dark-700 border border-dark-700"
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <Play className="absolute top-2 right-2 w-4 h-4 text-white/90 fill-white/90" />
                <p className="absolute bottom-1.5 left-2 right-2 text-[11px] text-white line-clamp-2">
                  {r.product?.name}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Search + sort */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-dark-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-10 pr-4 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder-dark-500 focus:border-primary-500"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="px-4 py-2.5 pr-10 bg-dark-800 border border-dark-700 rounded-xl text-white appearance-none focus:border-primary-500"
        >
          <option value="newest">Newest</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
        </select>
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-4">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => updateParams({ category: c })}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              category === c
                ? 'bg-primary-600 text-white'
                : 'bg-dark-800 border border-dark-700 text-dark-300 hover:text-white'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-dark-400">
          <PackageSearch className="w-12 h-12 mx-auto mb-3 text-dark-500" />
          <p>No products found.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-dark-400 mb-3">{total} product{total === 1 ? '' : 's'}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {products.length < total && (
            <div className="flex justify-center mt-6">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-6 py-2.5 bg-dark-800 border border-dark-700 hover:border-primary-600 rounded-xl text-white disabled:opacity-50 flex items-center gap-2"
              >
                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
