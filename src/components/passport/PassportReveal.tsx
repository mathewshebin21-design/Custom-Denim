"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

/**
 * A single, ceremonial one-shot reveal for the Art Passport — the moment a
 * one-of-one piece's provenance page is presented, not a looping or ambient
 * effect. GSAP owns this animation exclusively (Motion is used elsewhere,
 * in the Studio); nothing else animates this element's opacity/transform.
 *
 * Reduced-motion handling: gsap.matchMedia() only registers the "from"
 * tween inside the `(prefers-reduced-motion: no-preference)` query. Under
 * reduced motion, that branch never runs, so the element is never given an
 * initial hidden state at all — it simply renders at its natural, fully
 * visible CSS state. This means visibility never depends on JS running.
 */
export function PassportReveal({ children }: { children: React.ReactNode }) {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          container.current,
          { autoAlpha: 0, y: 24 },
          { autoAlpha: 1, y: 0, duration: 0.9, ease: "power3.out" },
        );
      });
      return () => mm.revert();
    },
    { scope: container },
  );

  return <div ref={container}>{children}</div>;
}
