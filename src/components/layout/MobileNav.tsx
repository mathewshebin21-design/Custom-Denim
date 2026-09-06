"use client";

import { useState } from "react";
import Link from "next/link";

const NAV_LINKS = [
  { href: "/create", label: "Studio" },
  { href: "/art", label: "Art" },
  { href: "/process", label: "Process" },
  { href: "/artists", label: "Artists" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Toggle menu"
        className="label-eyebrow text-ink/70"
      >
        {open ? "Close" : "Menu"}
      </button>
      {open && (
        <nav className="absolute inset-x-0 top-full z-50 border-b border-line bg-paper px-6 py-6 flex flex-col gap-4 shadow-sm">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="label-eyebrow text-ink/70 hover:text-rust"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
