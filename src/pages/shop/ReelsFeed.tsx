import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Volume2, VolumeX, Share2, ShoppingBag, Package, Film, Play } from 'lucide-react';
import { supabase, ReelWithProduct } from '../../lib/supabase';
import { formatPrice } from '../../lib/format';

export default function ReelsFeed() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const startId = searchParams.get('start');

  const [reels, setReels] = useState<ReelWithProduct[]>([]);
  const [shops, setShops] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [manualPaused, setManualPaused] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const didScrollToStart = useRef(false);

  // ---- Load reels (RLS only returns active reels of approved, active products) ----
  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase
        .from('reels')
        .select('*, product:products(*)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      const list = ((data as ReelWithProduct[]) ?? []).filter((r) => r.product);
      setReels(list);

      const sellerIds = [...new Set(list.map((r) => r.seller_id))];
      if (sellerIds.length > 0) {
        const { data: sellers } = await supabase
          .from('seller_profiles')
          .select('id, shop_name')
          .in('id', sellerIds);
        const map: Record<string, string> = {};
        (sellers as { id: string; shop_name: string }[] | null)?.forEach((s) => {
          map[s.id] = s.shop_name;
        });
        setShops(map);
      }
      setLoading(false);
    })();
  }, []);

  // ---- Jump to ?start=<reelId> once ----
  useEffect(() => {
    if (loading || didScrollToStart.current || !startId) return;
    const idx = reels.findIndex((r) => r.id === startId);
    didScrollToStart.current = true;
    if (idx > 0 && containerRef.current) {
      containerRef.current.scrollTo({ top: idx * containerRef.current.clientHeight });
      setActive(idx);
    }
  }, [loading, reels, startId]);

  // ---- Track which reel is on screen ----
  useEffect(() => {
    const root = containerRef.current;
    if (!root || reels.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.index);
            setActive(idx);
            setManualPaused(null);
          }
        });
      },
      { root, threshold: 0.6 }
    );

    root.querySelectorAll('[data-index]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [reels]);

  // ---- Play only the active video ----
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([key, video]) => {
      if (!video) return;
      const idx = Number(key);
      video.muted = muted;
      if (idx === active && manualPaused !== active) {
        video.play().catch(() => {});
      } else {
        video.pause();
        if (idx !== active) video.currentTime = 0;
      }
    });
  }, [active, muted, manualPaused, reels]);

  // ---- Keyboard navigation (desktop) ----
  const scrollByReel = useCallback((dir: 1 | -1) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollBy({ top: dir * el.clientHeight, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        scrollByReel(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        scrollByReel(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scrollByReel]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const togglePlay = (idx: number) => {
    const video = videoRefs.current[idx];
    if (!video) return;
    if (video.paused) {
      setManualPaused(null);
      video.play().catch(() => {});
    } else {
      setManualPaused(idx);
      video.pause();
    }
  };

  const share = async (reel: ReelWithProduct) => {
    const url = `${window.location.origin}/reels?start=${reel.id}`;
    const title = reel.product?.name ?? 'Reel';
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setToast('Link copied');
      }
    } catch {
      /* user cancelled */
    }
  };

  if (loading) {
    return (
      <div className="h-[calc(100dvh-60px)] flex items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (error || reels.length === 0) {
    return (
      <div className="h-[calc(100dvh-60px)] flex flex-col items-center justify-center bg-dark-900 text-center px-6">
        <Film className="w-12 h-12 text-dark-500 mb-3" />
        <p className="text-dark-400 mb-4">{error ?? 'No reels yet — check back soon.'}</p>
        <Link to="/shop" className="text-primary-400 hover:text-primary-300">
          Browse the shop
        </Link>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100dvh-60px)] bg-black">
      <div
        ref={containerRef}
        className="h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
      >
        {reels.map((reel, i) => {
          const product = reel.product!;
          const soldOut = product.stock <= 0;
          const near = Math.abs(i - active) <= 1;

          return (
            <section
              key={reel.id}
              data-index={i}
              className="h-full snap-start snap-always flex justify-center"
            >
              <div className="relative h-full w-full max-w-md bg-dark-900 overflow-hidden">
                <video
                  ref={(el) => {
                    videoRefs.current[i] = el;
                  }}
                  src={near ? reel.video_url : undefined}
                  poster={reel.thumbnail_url ?? undefined}
                  loop
                  muted={muted}
                  playsInline
                  preload={near ? 'auto' : 'none'}
                  onClick={() => togglePlay(i)}
                  className="absolute inset-0 w-full h-full object-cover"
                />

                {manualPaused === i && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Play className="w-16 h-16 text-white/80 fill-white/80" />
                  </div>
                )}

                {/* Right action rail */}
                <div className="absolute right-3 bottom-44 flex flex-col items-center gap-4 z-10">
                  <button
                    onClick={() => setMuted((m) => !m)}
                    className="w-11 h-11 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white"
                    aria-label={muted ? 'Unmute' : 'Mute'}
                  >
                    {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => share(reel)}
                    className="w-11 h-11 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white"
                    aria-label="Share"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>

                {/* Bottom info + Buy Now */}
                <div className="absolute inset-x-0 bottom-0 z-10 p-4 pt-24 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
                  {shops[reel.seller_id] && (
                    <p className="text-white font-semibold text-sm mb-1">@{shops[reel.seller_id]}</p>
                  )}
                  {reel.caption && (
                    <p className="text-white/90 text-sm line-clamp-2 mb-3 pr-14">{reel.caption}</p>
                  )}

                  <div className="flex items-center gap-3 bg-black/50 backdrop-blur rounded-2xl p-2.5 border border-white/10">
                    <Link
                      to={`/product/${product.id}`}
                      className="w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-dark-700 flex items-center justify-center"
                    >
                      {product.image_url ? (
                        <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-6 h-6 text-dark-500" />
                      )}
                    </Link>
                    <Link to={`/product/${product.id}`} className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{product.name}</p>
                      <p className="text-primary-400 font-bold">{formatPrice(product.price)}</p>
                    </Link>
                    <button
                      disabled={soldOut}
                      onClick={() => navigate(`/checkout/${product.id}?qty=1`)}
                      className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-dark-700 disabled:text-dark-400 text-white text-sm font-semibold rounded-xl"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      {soldOut ? 'Sold out' : 'Buy Now'}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {toast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/80 text-white text-sm z-20">
          {toast}
        </div>
      )}
    </div>
  );
}
