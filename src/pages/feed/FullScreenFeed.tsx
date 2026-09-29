import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Film, Loader2, Volume2, VolumeX } from 'lucide-react';
import { supabase, ReelWithProduct } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { AuthModal } from '../../components/AuthModal';
import ReelSlide from '../../components/feed/ReelSlide';

/**
 * Phase 14ক — TikTok-style full-screen vertical feed (reels only).
 * Mounted on a standalone test route (/feed-test) with no site header,
 * bottom nav or footer. Not the homepage yet (that is 14ঘ).
 */
export default function FullScreenFeed() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [reels, setReels] = useState<ReelWithProduct[]>([]);
  const [shops, setShops] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);

  // Likes (14খ)
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [showAuth, setShowAuth] = useState(false);
  const pendingLikes = useRef<Set<string>>(new Set());

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
      setCounts(Object.fromEntries(list.map((r) => [r.id, r.like_count ?? 0])));

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

  // ---- Which of these reels has the signed-in user liked? ----
  useEffect(() => {
    if (!user || reels.length === 0) {
      setLikedIds(new Set());
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('reel_likes')
        .select('reel_id')
        .eq('user_id', user.id)
        .in('reel_id', reels.map((r) => r.id));
      setLikedIds(new Set((data as { reel_id: string }[] | null)?.map((l) => l.reel_id) ?? []));
    })();
  }, [user, reels]);

  // ---- Like / unlike (optimistic, reverts if the request fails) ----
  const toggleLike = async (reelId: string) => {
    if (!user) {
      setShowAuth(true);
      return;
    }
    if (pendingLikes.current.has(reelId)) return;
    pendingLikes.current.add(reelId);

    const wasLiked = likedIds.has(reelId);
    const apply = (liked: boolean) => {
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (liked) next.add(reelId);
        else next.delete(reelId);
        return next;
      });
      setCounts((prev) => ({
        ...prev,
        [reelId]: Math.max((prev[reelId] ?? 0) + (liked ? 1 : -1), 0),
      }));
    };

    apply(!wasLiked);
    const { error: err } = wasLiked
      ? await supabase.from('reel_likes').delete().eq('reel_id', reelId).eq('user_id', user.id)
      : await supabase.from('reel_likes').insert({ reel_id: reelId, user_id: user.id });
    if (err) apply(wasLiked); // roll back
    pendingLikes.current.delete(reelId);
  };

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
                liked={likedIds.has(reel.id)}
                likeCount={counts[reel.id] ?? 0}
                onToggleLike={() => toggleLike(reel.id)}
              />
            </div>
          ))}
        </div>
      )}
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} title="Sign in to like reels" />
    </div>
  );
}
