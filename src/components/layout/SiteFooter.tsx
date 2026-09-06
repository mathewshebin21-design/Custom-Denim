import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-line mt-auto">
      <div className="container-editorial py-14 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-display text-lg mb-3">Custom Denim</p>
          <p className="text-sm text-ink/70 max-w-sm">
            AI-designed. Artist-made. One-of-one. A wearable-art studio where
            your story becomes an original garment, designed with AI and
            created by hand by a human artist.
          </p>
        </div>
        <div>
          <p className="label-eyebrow mb-4 text-ink/50">Studio</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/create" className="hover:text-rust">Custom Creation Studio</Link></li>
            <li><Link href="/art" className="hover:text-rust">Explore the Art</Link></li>
            <li><Link href="/process" className="hover:text-rust">How It Works</Link></li>
            <li><Link href="/artists" className="hover:text-rust">Our Artists</Link></li>
          </ul>
        </div>
        <div>
          <p className="label-eyebrow mb-4 text-ink/50">Account</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/account" className="hover:text-rust">My Commissions</Link></li>
            <li><Link href="/login" className="hover:text-rust">Sign In</Link></li>
            <li><Link href="/register" className="hover:text-rust">Create Account</Link></li>
          </ul>
        </div>
      </div>
      <div className="container-editorial py-6 border-t border-line text-xs text-ink/50">
        © {new Date().getFullYear()} Custom Denim Studio. Every piece is one-of-one.
      </div>
    </footer>
  );
}
