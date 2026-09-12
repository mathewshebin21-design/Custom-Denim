"use client";

import Link from "next/link";
import clsx from "clsx";
import { motion } from "motion/react";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] transition-colors disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-rust",
  secondary: "border border-ink text-ink hover:border-rust hover:text-rust",
  ghost: "text-ink hover:text-rust",
};

// A brief, user-initiated tap/hover response — not ambient or looping motion,
// so it's left unconditional rather than gated behind prefers-reduced-motion
// (which this app otherwise takes seriously — see StudioWorkspace's
// stagger-entrance and PassportReveal's GSAP reveal).
export function ButtonLink({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} className="inline-block">
      <Link href={href} className={clsx(base, variants[variant], className)}>
        {children}
      </Link>
    </motion.div>
  );
}

// Motion's own drag/animation event props (onDrag, onAnimationStart, ...)
// have a different, incompatible signature than the standard DOM ones —
// this component never needs any of them, so they're excluded rather than
// widened.
type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration"
>;

export function Button({
  variant = "primary",
  className,
  ...props
}: NativeButtonProps & { variant?: Variant }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className={clsx(base, variants[variant], className)}
      {...props}
    />
  );
}
