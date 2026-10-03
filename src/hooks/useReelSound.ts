import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'ar_reel_sound_pref';

type SoundPref = 'on' | 'off' | null;

function readPref(): SoundPref {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'on' || v === 'off' ? v : null;
  } catch {
    return null;
  }
}

function writePref(pref: 'on' | 'off') {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    /* private mode / storage blocked — the preference just won't persist */
  }
}

/**
 * Sound handling for the reel feeds (Phase 14ঙ).
 *
 * Browsers only allow autoplay WITH sound after the visitor has interacted with
 * the page, so reels start muted and sound switches on automatically after the
 * first tap / key press. If the visitor has deliberately muted before, that
 * choice is remembered and sound is never forced on.
 *
 * - `muted`          : pass to the videos
 * - `needsTap`       : true while sound is still off only because the browser
 *                      hasn't received a tap yet (show the "tap for sound" hint)
 * - `toggle`         : the mute / unmute button
 * - `onPlayBlocked`  : call when `video.play()` with sound was rejected; falls
 *                      back to muted playback and shows the hint again
 */
export function useReelSound() {
  const [pref, setPref] = useState<SoundPref>(readPref);
  const [unlocked, setUnlocked] = useState(false);

  // The first real interaction anywhere on the page unlocks sound.
  useEffect(() => {
    if (unlocked) return;
    const unlock = () => setUnlocked(true);
    const events: (keyof WindowEventMap)[] = ['pointerup', 'touchend', 'click', 'keydown'];
    events.forEach((e) => window.addEventListener(e, unlock, { passive: true, once: true }));
    return () => events.forEach((e) => window.removeEventListener(e, unlock));
  }, [unlocked]);

  // Sound is on once unlocked, unless the visitor chose to mute.
  const muted = !(unlocked && pref !== 'off');
  const needsTap = !unlocked && pref !== 'off';

  // Keep the latest value in a ref so toggle() can stay a stable function.
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const toggle = useCallback(() => {
    // The button press itself is a user gesture, so it also unlocks audio.
    const next: 'on' | 'off' = mutedRef.current ? 'on' : 'off';
    setUnlocked(true);
    setPref(next);
    writePref(next);
  }, []);

  const onPlayBlocked = useCallback(() => {
    // Browser refused sound: go back to muted and wait for another tap.
    setUnlocked(false);
  }, []);

  return { muted, needsTap, toggle, onPlayBlocked };
}
