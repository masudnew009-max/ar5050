import { Link, useNavigate } from 'react-router-dom';
import { Package, ShoppingBag } from 'lucide-react';
import type { Product } from '../../lib/supabase';
import { formatPrice } from '../../lib/format';

interface ProductSlideProps {
  product: Product;
  shopName?: string;
}

/** Full-screen card for an approved product that has no reel. */
export default function ProductSlide({ product, shopName }: ProductSlideProps) {
  const navigate = useNavigate();
  const soldOut = product.stock <= 0;

  return (
    <section className="flex h-full w-full snap-start snap-always justify-center bg-black">
      <div className="relative h-full w-full max-w-md overflow-hidden bg-dark-900">
        {product.image_url ? (
          <>
            {/* blurred fill so any photo shape looks intentional */}
            <img
              src={product.image_url}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
            />
            <Link
              to={`/product/${product.id}`}
              className="absolute inset-x-0 top-16 bottom-56 flex items-center justify-center"
            >
              <img
                src={product.image_url}
                alt={product.name}
                loading="lazy"
                className="max-h-full max-w-full object-contain"
              />
            </Link>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Package className="h-20 w-20 text-dark-600" />
          </div>
        )}

        <div
          className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-4 pt-24"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {shopName && <p className="mb-1 text-sm font-semibold text-white">@{shopName}</p>}
          <Link to={`/product/${product.id}`}>
            <h2 className="line-clamp-2 text-lg font-semibold text-white">{product.name}</h2>
          </Link>
          {product.description && (
            <p className="mt-1 line-clamp-2 text-sm text-white/70">{product.description}</p>
          )}

          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/50 p-3 backdrop-blur">
            <p className="text-xl font-bold text-primary-400">{formatPrice(product.price)}</p>
            <button
              disabled={soldOut}
              onClick={() => navigate(`/checkout/${product.id}?qty=1`)}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:bg-dark-700 disabled:text-dark-400"
            >
              <ShoppingBag className="h-4 w-4" />
              {soldOut ? 'Sold out' : 'Buy Now'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
