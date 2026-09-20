"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

const SESSION_KEY = "ease-wear-intro-seen";

/**
 * A one-shot cinematic front door for the homepage: the studio's own
 * animated logo reveal (real footage, not a synthesized animation) plays
 * full-screen, then fades away into the page. Gated by sessionStorage, not
 * replayed on every visit within the same tab — even at ~5 seconds, a
 * takeover on every navigation/refresh would stop being a "moment" and
 * start being an obstacle. Under prefers-reduced-motion it never renders at
 * all, matching PassportReveal's discipline elsewhere in this app: motion
 * is additive, never a gate in front of content.
 */
export function BrandIntro() {
  const prefersReducedMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } catch {
      // Storage inaccessible (private browsing, blocked cookies) — fall
      // through and show it; worst case it plays again next visit.
    }
    // Reads a browser-only API (sessionStorage) unavailable during SSR/the
    // first client render, so this can't be a lazy useState initializer
    // without risking a hydration mismatch — the effect is what makes this
    // safe to defer until after the first paint matches the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true);
  }, [prefersReducedMotion]);

  function dismiss() {
    setVisible(false);
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Nothing to do if storage isn't available — dismissal still works
      // for this page view, it just won't be remembered.
    }
  }

  useEffect(() => {
    if (!visible) return;
    // Safety net: if autoplay is blocked by the browser or the file fails
    // to load, never leave a visitor staring at a black overlay — check
    // shortly after mount and bail if playback never actually started.
    const timer = setTimeout(() => {
      if (videoRef.current && videoRef.current.currentTime === 0) dismiss();
    }, 1800);
    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-paper"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          <video
            ref={videoRef}
            src="/video/logo-reveal.mp4"
            poster="/video/logo-reveal-poster.jpg"
            autoPlay
            muted
            playsInline
            onEnded={dismiss}
            onError={dismiss}
            className="h-full max-h-screen w-auto object-contain"
          />
          <button
            type="button"
            onClick={dismiss}
            className="absolute bottom-6 right-6 label-eyebrow text-xs text-ink/60 hover:text-rust"
          >
            Skip →
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
