import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import { Product } from '../../lib/supabase';
import { formatPrice } from '../../lib/format';

export default function ProductCard({ product }: { product: Product }) {
  const soldOut = product.stock <= 0;

  return (
    <Link
      to={`/product/${product.id}`}
      className="group bg-dark-800/70 border border-dark-700 hover:border-primary-600/60 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30 rounded-2xl overflow-hidden transition-all duration-200 flex flex-col"
    >
      <div className="relative aspect-square bg-dark-700">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${soldOut ? 'opacity-50' : ''}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-10 h-10 text-dark-500" />
          </div>
        )}
        {soldOut && (
          <span className="absolute top-2 left-2 text-[11px] px-2.5 py-1 rounded-full bg-red-500/90 text-white font-medium">
            Sold out
          </span>
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col">
        {product.category && (
          <span className="text-[11px] uppercase tracking-wide text-primary-400/90 mb-1 truncate">{product.category}</span>
        )}
        <h3 className="text-white text-sm font-medium line-clamp-2 mb-2">{product.name}</h3>
        <p className="mt-auto text-white font-bold text-base">{formatPrice(product.price)}</p>
      </div>
    </Link>
  );
}
