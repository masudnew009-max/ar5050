import { useEffect, useRef, useState } from 'react';

/** A slide counts as "the one on screen" once this much of it is visible. */
const ACTIVE_RATIO = 0.6;

/**
 * Which slide of a vertical snap-scroll feed is on screen (Phase 14চ-২).
 * Shared by the home feed and /reels so both behave the same.
 *
 * - `root` is the scroll container ELEMENT held in state (not a ref): the container
 *   only exists after the feed has loaded, and a ref change would not re-run this
 *   effect — the observer would then never attach and the active slide would stay 0.
 * - A slide becomes active only when it is at least 60% visible. Checking just
 *   `isIntersecting` is not enough: it stays true while a slide is leaving (ratio
 *   0.6 -> 0.4), which made the OLD slide win when scrolling up.
 * - Slides must carry a `data-index` attribute.
 */
export function useActiveSlide(root: HTMLElement | null, count: number, onChange?: (index: number) => void) {
  const [active, setActive] = useState(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!root || count === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= ACTIVE_RATIO) {
            const index = Number((entry.target as HTMLElement).dataset.index);
            setActive(index);
            onChangeRef.current?.(index);
          }
        });
      },
      { root, threshold: [ACTIVE_RATIO] }
    );

    root.querySelectorAll('[data-index]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [root, count]);

  return [active, setActive] as const;
}
