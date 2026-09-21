import type { Metadata } from "next";
import Image from "next/image";
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
            <div key={artist.id} id={artist.id} className="bg-paper p-8 scroll-mt-24">
              <div className="relative aspect-square w-20 mb-5 overflow-hidden rounded-full bg-paper-dim">
                {artist.photoUrl ? (
                  <Image src={artist.photoUrl} alt={artist.name} fill sizes="80px" className="object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-display text-2xl text-ink/30">
                    {artist.name.charAt(0)}
                  </div>
                )}
              </div>
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

      {/* Lightweight, no-application-form path for a new artist to reach
          out — deliberately just an email prompt, not a signup flow, since
          there's no self-service artist onboarding yet. See AGENTS.md/this
          repo's history for why: this is the "first tiny step" version. */}
      <div className="mt-16 border border-line p-8 sm:p-12 max-w-2xl">
        <p className="label-eyebrow text-rust mb-4">Are You an Artist?</p>
        <h2 className="font-display text-2xl mb-4">Show your talent to the world.</h2>
        <p className="text-sm text-ink/70 mb-6">
          If you paint, embroider, or otherwise hand-make wearable art and
          want in, there&apos;s no application to fill out. Email us — we&apos;ll
          assign you a first small project to try, and you&apos;re paid based
          on what it sells for. No commitment beyond that first piece.
        </p>
        <a
          href="mailto:easewear26@gmail.com?subject=I%27d%20like%20to%20create%20with%20Ease%20Wear"
          className="label-eyebrow text-sm underline hover:text-rust"
        >
          easewear26@gmail.com →
        </a>
      </div>
    </div>
  );
}
