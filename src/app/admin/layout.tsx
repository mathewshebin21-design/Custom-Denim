import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";

// src/proxy.ts already redirects unauthenticated/non-admin requests away
// from /admin/*, but that is the only line of defense unless every page
// (and this layout, which every admin page renders inside of) also checks
// independently. Defense in depth: this must never be the sole gate.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div>
      <div className="border-b border-line bg-paper-dim/30">
        <div className="container-editorial flex h-14 items-center gap-8">
          <Link href="/admin" className="label-eyebrow hover:text-rust">Overview</Link>
          <Link href="/admin/commissions" className="label-eyebrow hover:text-rust">Commissions</Link>
        </div>
      </div>
      {children}
    </div>
  );
}
