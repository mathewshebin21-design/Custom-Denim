import type { Metadata } from "next";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Artists",
  description: "The human artists who hand-make every one-of-one piece.",
};

export default async function ArtistsPage() {
  const artists = await db.artist.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="container-editorial py-24">
      <p className="label-eyebrow text-rust mb-4">The Artists</p>
      <h1 className="font-display text-5xl max-w-2xl mb-8">
        Every piece is made by hand, by a real artist.
      </h1>
      <p className="max-w-2xl text-ink/70 mb-16">
        AI never touches the garment. These are the people who do — matched
        to your concept by style and capability, with final say on every
        piece that leaves the studio.
      </p>

      <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
        {artists.map((artist) => {
          const styleTags: string[] = JSON.parse(artist.styleTagsJson || "[]");
          return (
            <div key={artist.id} className="bg-paper p-8">
              <p className="font-display text-xl mb-2">{artist.name}</p>
              <p className="text-sm text-ink/70 mb-4">{artist.bio}</p>
              <div className="flex flex-wrap gap-2">
                {styleTags.map((tag) => (
                  <span key={tag} className="label-eyebrow text-[10px] border border-line px-2 py-1 text-ink/60">
                    {tag}
                  </span>
                ))}
              </div>
              <p className="mt-6 text-xs text-ink/40 uppercase tracking-wider">
                {artist.capacityStatus === "available"
                  ? "Accepting new commissions"
                  : artist.capacityStatus === "limited"
                    ? "Limited availability"
                    : "At capacity"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
