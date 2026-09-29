import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Package, Play, ShoppingBag } from 'lucide-react';
import type { ReelWithProduct } from '../../lib/supabase';
import { formatCount, formatPrice } from '../../lib/format';

interface ReelSlideProps {
  reel: ReelWithProduct;
  shopName?: string;
  /** This slide is the one currently centered on screen. */
  isActive: boolean;
  /** Active slide or its direct neighbour — only these load video data. */
  isNear: boolean;
  muted: boolean;
  liked: boolean;
  likeCount: number;
  onToggleLike: () => void;
}

/**
 * One full-screen reel: video, seller/caption, and a Buy Now bar.
 * Plays only while active, pauses (and rewinds) when scrolled away.
 */
export default function ReelSlide({ reel, shopName, isActive, isNear, muted, liked, likeCount, onToggleLike }: ReelSlideProps) {
  const navigate = useNavigate();
  const product = reel.product!;
  const soldOut = product.stock <= 0;

  const videoRef = useRef<HTMLVideoElement>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  // Reset the manual pause whenever this slide stops being the active one.
  useEffect(() => {
    if (!isActive) setUserPaused(false);
  }, [isActive]);

  // Auto play / pause
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;

    if (isActive && !userPaused) {
      video.play().catch(() => {
        /* autoplay blocked — the tap-to-play icon covers this */
      });
    } else {
      video.pause();
      if (!isActive) {
        video.currentTime = 0;
        setProgress(0);
      }
    }
  }, [isActive, userPaused, muted, isNear]);

  // Pause when the browser tab is hidden
  useEffect(() => {
    if (!isActive) return;
    const onVisibility = () => {
      const video = videoRef.current;
      if (!video) return;
      if (document.hidden) video.pause();
      else if (!userPaused) video.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [isActive, userPaused]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      setUserPaused(false);
      video.play().catch(() => {});
    } else {
      setUserPaused(true);
      video.pause();
    }
  };

  return (
    <section className="h-full w-full snap-start snap-always flex justify-center bg-black">
      <div className="relative h-full w-full max-w-md overflow-hidden bg-dark-900">
        <video
          ref={videoRef}
          src={isNear ? reel.video_url : undefined}
          poster={reel.thumbnail_url ?? undefined}
          loop
          muted={muted}
          playsInline
          preload={isNear ? 'auto' : 'none'}
          onClick={togglePlay}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            if (isActive && v.duration) setProgress(v.currentTime / v.duration);
          }}
          className="absolute inset-0 h-full w-full object-cover"
        />

        {isActive && userPaused && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Play className="h-16 w-16 fill-white/80 text-white/80" />
          </div>
        )}

        {/* Right action rail: Like + Comment (comment opens the product page for now) */}
        <div
          className="absolute right-3 z-20 flex flex-col items-center gap-5"
          style={{ bottom: 'calc(11rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <button
            onClick={onToggleLike}
            className="flex flex-col items-center gap-1 text-white"
            aria-label={liked ? 'Unlike' : 'Like'}
            aria-pressed={liked}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur">
              <Heart
                className={`h-6 w-6 transition-transform active:scale-125 ${
                  liked ? 'fill-red-500 text-red-500' : ''
                }`}
              />
            </span>
            <span className="text-xs font-semibold drop-shadow">{formatCount(likeCount)}</span>
          </button>
          <button
            onClick={() => navigate(`/product/${product.id}`)}
            className="flex flex-col items-center gap-1 text-white"
            aria-label="Comments — open product page"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur">
              <MessageCircle className="h-6 w-6" />
            </span>
          </button>
        </div>

        {/* Bottom info + Buy Now */}
        <div
          className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pt-28"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {shopName && <p className="mb-1 text-sm font-semibold text-white">@{shopName}</p>}
          {reel.caption && (
            <p className="mb-3 line-clamp-2 pr-10 text-sm text-white/90">{reel.caption}</p>
          )}

          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/50 p-2.5 backdrop-blur">
            <Link
              to={`/product/${product.id}`}
              className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-dark-700"
            >
              {product.image_url ? (
                <img src={product.image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <Package className="h-6 w-6 text-dark-500" />
              )}
            </Link>
            <Link to={`/product/${product.id}`} className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{product.name}</p>
              <p className="font-bold text-primary-400">{formatPrice(product.price)}</p>
            </Link>
            <button
              disabled={soldOut}
              onClick={() => navigate(`/checkout/${product.id}?qty=1`)}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:bg-dark-700 disabled:text-dark-400"
            >
              <ShoppingBag className="h-4 w-4" />
              {soldOut ? 'Sold out' : 'Buy Now'}
            </button>
          </div>
        </div>

        {/* Progress line */}
        <div className="absolute inset-x-0 bottom-0 z-20 h-0.5 bg-white/20">
          <div className="h-full bg-white/80" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </section>
  );
}
