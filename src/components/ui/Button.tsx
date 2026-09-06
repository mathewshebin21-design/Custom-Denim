import Link from "next/link";
import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] transition-colors disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-rust",
  secondary: "border border-ink text-ink hover:border-rust hover:text-rust",
  ghost: "text-ink hover:text-rust",
};

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
    <Link href={href} className={clsx(base, variants[variant], className)}>
      {children}
    </Link>
  );
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={clsx(base, variants[variant], className)} {...props} />;
}
