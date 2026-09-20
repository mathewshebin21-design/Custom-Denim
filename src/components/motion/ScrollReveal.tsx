"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * A single, one-shot fade/rise as a section enters the viewport while
 * scrolling the homepage — the scroll-driven counterpart to PassportReveal's
 * on-mount reveal, same reduced-motion discipline: gsap.matchMedia() only
 * registers the tween (and the ScrollTrigger driving it) inside
 * `(prefers-reduced-motion: no-preference)`, so under reduced motion the
 * section is never hidden pending a scroll event — it renders at its
 * natural, fully visible state from the start.
 */
export function ScrollReveal({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  /** Wrapping element tag — "section" preserves the semantic sectioning
   * this wraps around on the homepage, where every reveal wraps a whole
   * <section>, not just an inline chunk of it. */
  as?: "div" | "section";
}) {
  const container = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          container.current,
          { autoAlpha: 0, y: 32 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: {
              trigger: container.current,
              start: "top 85%",
              once: true,
            },
          },
        );
      });
      return () => mm.revert();
    },
    { scope: container },
  );

  return (
    // Tag is either "div" or "section" at the call site — both accept a
    // plain HTMLElement ref at runtime; only their JSX prop typings differ
    // narrower than that, hence the cast.
    <Tag ref={container as React.Ref<HTMLDivElement & HTMLElement>} className={className}>
      {children}
    </Tag>
  );
}
