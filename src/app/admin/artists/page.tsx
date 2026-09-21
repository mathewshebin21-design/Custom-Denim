import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { listArtistsForAdmin } from "@/lib/admin/service";
import { AdminArtistManager } from "@/components/admin/AdminArtistManager";

export const metadata: Metadata = { title: "Artists — Admin" };

export default async function AdminArtistsPage() {
  await requireAdmin();
  const artists = await listArtistsForAdmin();

  return (
    <div className="container-editorial py-16">
      <p className="label-eyebrow text-rust mb-4">Admin</p>
      <h1 className="font-display text-4xl mb-12">Artists</h1>
      <AdminArtistManager initialArtists={artists} />
    </div>
  );
}
