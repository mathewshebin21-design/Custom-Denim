import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
