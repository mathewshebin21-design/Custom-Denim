import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { ButtonLink } from "@/components/ui/Button";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { MobileNav } from "@/components/layout/MobileNav";

const NAV_LINKS = [
  { href: "/create", label: "Studio" },
  { href: "/shop", label: "Shop" },
  { href: "/art", label: "Art" },
  { href: "/process", label: "Process" },
  { href: "/artists", label: "Artists" },
];

export async function SiteHeader() {
  const session = await getSession();

  return (
    <header className="relative border-b border-line">
      <div className="container-editorial flex h-20 items-center justify-between">
        <Link href="/" className="flex flex-col items-center gap-0.5 whitespace-nowrap">
          {/* Stacked lockup — the wordmark sits directly under the monogram,
              matching the studio's actual logo (icon on top, "EASE WEAR"
              centered beneath it), not a side-by-side arrangement. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- static vector
              logo assets; next/image's optimizer doesn't serve local SVGs
              without enabling dangerouslyAllowSVG, not worth it for two
              small, fully-trusted, self-authored vector files */}
          <img src="/brand/ease-wear-mark.svg" alt="" width={30} height={30} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/ease-wear-wordmark.svg" alt="Ease Wear" width={88} height={28} />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="label-eyebrow text-ink/70 hover:text-rust"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          {session ? (
            <>
              <Link
                href={session.role === "admin" ? "/admin" : "/account"}
                className="label-eyebrow text-ink/70 hover:text-rust"
              >
                {session.role === "admin" ? "Admin" : "My Account"}
              </Link>
              <SignOutButton />
            </>
          ) : (
            <Link href="/login" className="label-eyebrow text-ink/70 hover:text-rust">
              Sign In
            </Link>
          )}
          <Link href="/cart" className="label-eyebrow text-ink/70 hover:text-rust">
            Cart
          </Link>
          <span className="hidden sm:inline-flex">
            <ButtonLink href="/create">Create Your Piece</ButtonLink>
          </span>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
