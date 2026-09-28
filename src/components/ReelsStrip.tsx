import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Film, Play } from 'lucide-react';
import { supabase, ReelWithProduct } from '../lib/supabase';

/** Horizontal strip of reel thumbnails. Renders nothing if there are no reels. */
export default function ReelsStrip({ limit = 12, title = 'Shop from reels' }: { limit?: number; title?: string }) {
  const [reels, setReels] = useState<ReelWithProduct[]>([]);

  useEffect(() => {
    supabase
      .from('reels')
      .select('*, product:products(*)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(({ data }) => setReels(((data as ReelWithProduct[]) ?? []).filter((r) => r.product)));
  }, [limit]);

  if (reels.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          <span className="w-8 h-8 rounded-lg bg-primary-600/15 flex items-center justify-center">
            <Film className="w-4 h-4 text-primary-400" />
          </span>
          {title}
        </h2>
        <Link to="/reels" className="text-sm text-primary-400 hover:text-primary-300 font-medium">
          Watch all →
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 lg:mx-0 lg:px-0">
        {reels.map((r) => (
          <Link
            key={r.id}
            to={`/reels?start=${r.id}`}
            className="group relative shrink-0 w-32 sm:w-36 aspect-[9/16] rounded-2xl overflow-hidden bg-dark-800 border border-dark-700 hover:border-primary-600/60 transition-all"
          >
            {r.thumbnail_url ? (
              <img src={r.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
            ) : (
              <video
                src={`${r.video_url}#t=0.1`}
                preload="metadata"
                muted
                playsInline
                className="w-full h-full object-cover pointer-events-none"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
            <span className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
              <Play className="w-3.5 h-3.5 text-white fill-white" />
            </span>
            <p className="absolute bottom-2 left-2.5 right-2.5 text-xs font-medium text-white line-clamp-2">{r.product?.name}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
