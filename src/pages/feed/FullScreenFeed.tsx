import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Film, Loader2, Volume2, VolumeX } from 'lucide-react';
import { supabase, ReelWithProduct } from '../../lib/supabase';
import ReelSlide from '../../components/feed/ReelSlide';

/**
 * Phase 14ক — TikTok-style full-screen vertical feed (reels only).
 * Mounted on a standalone test route (/feed-test) with no site header,
 * bottom nav or footer. Not the homepage yet (that is 14ঘ).
 */
export default function FullScreenFeed() {
  const navigate = useNavigate();

  const [reels, setReels] = useState<ReelWithProduct[]>([]);
  const [shops, setShops] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);

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

  // ---- Track which slide is centered ----
  useEffect(() => {
    const root = containerRef.current;
    if (!root || reels.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActive(Number((entry.target as HTMLElement).dataset.index));
          }
        });
      },
      { root, threshold: 0.6 }
    );

    root.querySelectorAll('[data-index]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [reels]);

  // ---- Arrow-key navigation (desktop) ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = containerRef.current;
      if (!el) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        el.scrollBy({
          top: (e.key === 'ArrowDown' ? 1 : -1) * el.clientHeight,
          behavior: 'smooth',
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/'));

  return (
    <div className="fixed inset-0 bg-black">
      {/* Floating controls — the only chrome on this screen */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex w-full max-w-md items-center justify-between px-3">
          <button
            onClick={goBack}
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          {reels.length > 0 && (
            <button
              onClick={() => setMuted((m) => !m)}
              className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur"
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      ) : error || reels.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <Film className="mb-3 h-12 w-12 text-dark-500" />
          <p className="mb-4 text-dark-400">{error ?? 'No reels yet — check back soon.'}</p>
          <Link to="/shop" className="text-primary-400 hover:text-primary-300">
            Browse the shop
          </Link>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="no-scrollbar h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain"
        >
          {reels.map((reel, i) => (
            <div key={reel.id} data-index={i} className="h-full w-full">
              <ReelSlide
                reel={reel}
                shopName={shops[reel.seller_id]}
                isActive={i === active}
                isNear={Math.abs(i - active) <= 1}
                muted={muted}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
