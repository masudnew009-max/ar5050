import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingBag, Film, Search, Banknote, ShieldCheck, Store, ArrowRight, Package, Sparkles,
} from 'lucide-react';
import { supabase, Product } from '../lib/supabase';
import { PRODUCT_CATEGORIES } from '../lib/categories';
import { categoryIcon } from '../lib/category-icons';
import { BRAND } from '../lib/brand';
import { useAuth } from '../hooks/useAuth';
import { AuthModal } from '../components/AuthModal';
import ReelsStrip from '../components/ReelsStrip';
import ProductCard from './shop/ProductCard';

const TRUST = [
  { icon: Banknote, title: 'Cash on Delivery', text: 'Pay when your order arrives.' },
  { icon: ShieldCheck, title: 'Reviewed products', text: 'Every listing is approved by our team.' },
  { icon: Film, title: 'Shoppable reels', text: 'Watch a product, buy in one tap.' },
  { icon: Store, title: 'Many sellers', text: 'Independent shops, one marketplace.' },
];

export default function Home() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    supabase
      .from('products')
      .select('*')
      .eq('status', 'approved')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(8)
      .then(({ data }) => {
        setProducts((data as Product[]) ?? []);
        setLoaded(true);
      });
  }, []);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/shop?q=${encodeURIComponent(q)}` : '/shop');
  };

  const mosaic = products.filter((p) => p.image_url).slice(0, 4);
  const canBecomeSeller = profile?.role === 'customer';
  const isSellerish = profile?.role === 'seller' || profile?.role === 'admin';

  return (
    <div className="space-y-14 lg:space-y-16 text-white">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-primary-900/70 via-dark-800 to-dark-900">
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="absolute -bottom-32 right-0 w-96 h-96 rounded-full bg-primary-600/10 blur-3xl" />

        <div className="relative grid lg:grid-cols-2 gap-8 items-center p-6 sm:p-10 lg:p-14">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-primary-300 mb-5">
              <Sparkles className="w-3.5 h-3.5" /> {BRAND.tagline}
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight">
              Discover great products from <span className="text-primary-400">independent sellers</span>
            </h1>
            <p className="mt-4 text-dark-300 max-w-lg">
              Browse the shop or watch shoppable reels — find something you like and order in a few taps, with Cash on Delivery.
            </p>

            <form onSubmit={search} className="mt-7 flex max-w-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-dark-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for a product..."
                  className="w-full pl-11 pr-4 py-3.5 bg-dark-900/80 border border-dark-600 focus:border-primary-500 rounded-l-full text-sm text-white placeholder-dark-500"
                />
              </div>
              <button className="px-6 bg-primary-600 hover:bg-primary-500 rounded-r-full text-sm font-semibold transition-colors">
                Search
              </button>
            </form>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/shop" className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-500 rounded-full font-semibold text-sm shadow-lg shadow-primary-600/30 transition-colors">
                <ShoppingBag className="w-4 h-4" /> Browse Shop
              </Link>
              <Link to="/reels" className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full font-semibold text-sm transition-colors">
                <Film className="w-4 h-4 text-primary-400" /> Watch Reels
              </Link>
            </div>
          </div>

          {/* Product mosaic (falls back to decorative tiles when there are no products yet) */}
          <div className="hidden lg:grid grid-cols-2 gap-4">
            {(mosaic.length > 0 ? mosaic : [null, null, null, null]).map((p, i) => (
              <div
                key={p?.id ?? i}
                className={`aspect-square rounded-2xl overflow-hidden border border-white/10 bg-dark-700/60 shadow-xl shadow-black/30 ${
                  i % 2 === 1 ? 'translate-y-6' : ''
                }`}
              >
                {p?.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-10 h-10 text-dark-500" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {TRUST.map((t) => (
          <div key={t.title} className="flex items-start gap-3 p-4 rounded-2xl bg-dark-800/60 border border-dark-700">
            <span className="w-10 h-10 shrink-0 rounded-xl bg-primary-600/15 flex items-center justify-center">
              <t.icon className="w-5 h-5 text-primary-400" />
            </span>
            <div>
              <p className="text-sm font-semibold">{t.title}</p>
              <p className="text-xs text-dark-400 mt-0.5">{t.text}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Categories */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Shop by category</h2>
          <Link to="/shop" className="text-sm text-primary-400 hover:text-primary-300 font-medium">All products →</Link>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {PRODUCT_CATEGORIES.filter((c) => c !== 'Other').map((c) => {
            const Icon = categoryIcon(c);
            return (
              <Link
                key={c}
                to={`/shop?category=${encodeURIComponent(c)}`}
                className="group flex flex-col items-center text-center gap-2.5 p-3 sm:p-4 rounded-2xl bg-dark-800/60 border border-dark-700 hover:border-primary-600/60 hover:-translate-y-0.5 transition-all"
              >
                <span className="w-12 h-12 rounded-full bg-primary-600/15 group-hover:bg-primary-600/25 flex items-center justify-center transition-colors">
                  <Icon className="w-5 h-5 text-primary-400" />
                </span>
                <span className="text-xs font-medium text-dark-200 leading-tight">{c}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Latest products */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Latest products</h2>
          <Link to="/shop" className="text-sm text-primary-400 hover:text-primary-300 font-medium">View all →</Link>
        </div>
        {loaded && products.length === 0 ? (
          <div className="text-center py-12 rounded-2xl bg-dark-800/40 border border-dashed border-dark-700 text-dark-400 text-sm">
            No products yet — check back soon.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-5">
            {(loaded ? products : Array.from({ length: 4 })).map((p, i) =>
              p ? (
                <ProductCard key={(p as Product).id} product={p as Product} />
              ) : (
                <div key={i} className="aspect-[3/4] rounded-2xl bg-dark-800/60 animate-pulse" />
              )
            )}
          </div>
        )}
      </section>

      <ReelsStrip limit={12} />

      {/* Seller CTA */}
      {!isSellerish && (
        <section className="relative overflow-hidden rounded-3xl border border-primary-600/30 bg-gradient-to-r from-primary-800/60 to-dark-800 p-8 lg:p-12">
          <div className="absolute -right-10 -top-10 w-56 h-56 rounded-full bg-primary-500/15 blur-3xl" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h2 className="text-2xl font-bold">Have something to sell?</h2>
              <p className="text-dark-300 mt-2 max-w-xl text-sm">
                Open your own shop, upload products and reels, and reach customers across the marketplace.
              </p>
            </div>
            {canBecomeSeller ? (
              <Link to="/become-seller" className="inline-flex items-center gap-2 px-7 py-3.5 bg-primary-600 hover:bg-primary-500 rounded-full font-semibold text-sm whitespace-nowrap self-start md:self-auto">
                Become a Seller <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-primary-600 hover:bg-primary-500 rounded-full font-semibold text-sm whitespace-nowrap self-start md:self-auto"
              >
                {user ? 'Continue' : 'Sign up to sell'} <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </section>
      )}

      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
    </div>
  );
}
