/**
 * Video loading policy for the reel feeds (Phase 14চ-৩).
 *
 *  full — src set, preload "auto": the video being watched and the one right after it
 *  meta — src set, preload "metadata": the previous video (only so going back is quick)
 *  off  — no src and any data already downloaded is released: everything else
 *
 * On a slow connection (or Data Saver) the next video only loads its metadata, and while
 * the video being watched is itself stuck buffering, no neighbour downloads at all, so
 * the one on screen gets the whole connection.
 */
export type LoadMode = 'full' | 'meta' | 'off';

/** Small wait before play() so slides flung past during a fast swipe never make a sound. */
export const PLAY_DELAY_MS = 90;

/** How long the video on screen may be buffering before neighbours stop loading. */
export const STALL_AFTER_MS = 1500;

type NetworkInfo = { saveData?: boolean; effectiveType?: string };

export function isSlowConnection(): boolean {
  if (typeof navigator === 'undefined') return false;
  const conn = (navigator as Navigator & { connection?: NetworkInfo }).connection;
  if (!conn) return false;
  return !!conn.saveData || ['slow-2g', '2g', '3g'].includes(conn.effectiveType ?? '');
}

export function loadModeFor(distance: number, activeStalled: boolean, slow: boolean): LoadMode {
  if (distance === 0) return 'full';
  if (activeStalled) return 'off';
  if (distance === 1) return slow ? 'meta' : 'full';
  if (distance === -1) return slow ? 'off' : 'meta';
  return 'off';
}

export function preloadFor(mode: LoadMode): 'auto' | 'metadata' | 'none' {
  return mode === 'full' ? 'auto' : mode === 'meta' ? 'metadata' : 'none';
}

/**
 * Really release a video's data. Dropping the `src` prop only removes the attribute,
 * the browser keeps the old resource (and keeps downloading it) until load() is called.
 * React removes the attribute itself before our effects run, so callers must track
 * whether the video ever had a source (see `hadSource` in ReelSlide / ReelsFeed)
 * instead of checking the attribute here.
 */
export function unloadVideo(video: HTMLVideoElement): void {
  video.pause();
  video.removeAttribute('src');
  video.load();
}
