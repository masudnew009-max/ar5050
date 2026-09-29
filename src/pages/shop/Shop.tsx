import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Loader2, PackageSearch } from 'lucide-react';
import { supabase, Product } from '../../lib/supabase';
import ReelsStrip from '../../components/ReelsStrip';
import CategoryGrid from './CategoryGrid';
import { useSubcategories } from '../../hooks/useSubcategories';
import ProductCard from './ProductCard';

const PAGE_SIZE = 24;
type Sort = 'newest' | 'price_asc' | 'price_desc';

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('category') || 'All';
  const sub = searchParams.get('sub') || '';
  const urlQuery = searchParams.get('q') || '';
  const subMap = useSubcategories();
  const subs = category !== 'All' ? subMap[category] ?? [] : [];

  const [searchInput, setSearchInput] = useState(urlQuery);
  const [sort, setSort] = useState<Sort>('newest');

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(0);

  const updateParams = (next: { category?: string; sub?: string; q?: string }) => {
    const params = new URLSearchParams(searchParams);
    if (next.category !== undefined) {
      if (next.category === 'All') params.delete('category');
      else params.set('category', next.category);
      params.delete('sub'); // a new category clears the sub-category
    }
    if (next.sub !== undefined) {
      if (next.sub) params.set('sub', next.sub);
      else params.delete('sub');
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
    if (category !== 'All' && sub) query = query.eq('subcategory', sub);
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
  }, [category, sub, urlQuery, sort]);

  const loadMore = async () => {
    setLoadingMore(true);
    const { data, error: err } = await fetchProducts(products.length);
    if (err) setError(err.message);
    else setProducts((prev) => [...prev, ...((data as Product[]) ?? [])]);
    setLoadingMore(false);
  };

  return (
    <div className="text-white">
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold">Shop</h1>
        <p className="text-sm text-dark-400 mt-1">Browse approved products from all sellers.</p>
      </div>

      <div className="mb-6">
        <CategoryGrid selected={category} onSelect={(c) => updateParams({ category: c })} />
      </div>

      {subs.length > 0 && (
        <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          {['', ...subs].map((s) => (
            <button
              key={s || 'all'}
              onClick={() => updateParams({ sub: s })}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                sub === s
                  ? 'bg-primary-600 text-white'
                  : 'border border-dark-700 bg-dark-800 text-dark-300 hover:text-white'
              }`}
            >
              {s || `All ${category}`}
            </button>
          ))}
        </div>
      )}

      <div className="mb-8"><ReelsStrip limit={12} /></div>

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
