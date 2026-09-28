import { Link } from 'react-router-dom';
import { ShoppingBag, Film } from 'lucide-react';
import { PRODUCT_CATEGORIES } from '../lib/categories';

export default function Home() {
  return (
    <div className="text-white max-w-5xl mx-auto py-8">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600/20 rounded-2xl mb-6">
          <ShoppingBag className="w-8 h-8 text-primary-400" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-3">Multi-Vendor Marketplace</h1>
        <p className="text-dark-400 max-w-xl mx-auto mb-6">
          Discover products from independent sellers — browse the shop or watch shoppable reels
          and buy in one tap.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/shop"
            className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-xl font-semibold shadow-lg shadow-primary-600/30"
          >
            <ShoppingBag className="w-5 h-5" /> Browse Shop
          </Link>
          <Link
            to="/reels"
            className="flex items-center gap-2 px-6 py-3 bg-dark-800 border border-dark-700 hover:border-primary-600 rounded-xl font-semibold"
          >
            <Film className="w-5 h-5 text-primary-400" /> Watch Reels
          </Link>
        </div>
      </div>

      <h2 className="font-semibold mb-3">Shop by category</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {PRODUCT_CATEGORIES.map((c) => (
          <Link
            key={c}
            to={`/shop?category=${encodeURIComponent(c)}`}
            className="px-4 py-4 bg-dark-800 border border-dark-700 hover:border-primary-600/60 rounded-xl text-sm font-medium transition-colors"
          >
            {c}
          </Link>
        ))}
      </div>
    </div>
  );
}
