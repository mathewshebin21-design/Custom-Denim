import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { ButtonLink } from "@/components/ui/Button";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { MobileNav } from "@/components/layout/MobileNav";

const NAV_LINKS = [
  { href: "/create", label: "Studio" },
  { href: "/art", label: "Art" },
  { href: "/process", label: "Process" },
  { href: "/artists", label: "Artists" },
];

export async function SiteHeader() {
  const session = await getSession();

  return (
    <header className="relative border-b border-line">
      <div className="container-editorial flex h-20 items-center justify-between">
        <Link href="/" className="font-display text-xl tracking-tight whitespace-nowrap">
          Custom Denim
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
          <span className="hidden sm:inline-flex">
            <ButtonLink href="/create">Create Your Piece</ButtonLink>
          </span>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
