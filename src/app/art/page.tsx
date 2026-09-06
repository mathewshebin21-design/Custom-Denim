import type { Metadata } from "next";
import { db } from "@/lib/db";
import { PieceCard } from "@/components/art/PieceCard";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Explore the Art",
  description: "Completed one-of-one wearable-art pieces, each with its own Art Passport.",
};

export default async function ArtPage() {
  const artworks = await db.artwork.findMany({
    where: { completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
    include: {
      commission: { include: { garment: true } },
      approvedVersion: { include: { creativeDirection: true } },
      passport: true,
    },
  });

  return (
    <div className="container-editorial py-24">
      <p className="label-eyebrow text-rust mb-4">Explore the Art</p>
      <h1 className="font-display text-5xl max-w-2xl mb-8">
        Completed one-of-one pieces.
      </h1>
      <p className="max-w-2xl text-ink/70 mb-16">
        Every piece here is finished, worn, and documented with its own Art
        Passport — provenance, materials, and the artist who made it.
      </p>

      {artworks.length === 0 ? (
        <div className="border border-dashed border-line py-24 text-center">
          <p className="font-display text-xl mb-2">Nothing completed yet.</p>
          <p className="text-sm text-ink/60 max-w-md mx-auto mb-8">
            This gallery fills in as commissions finish production. Start
            yours today and be among the first.
          </p>
          <ButtonLink href="/create">Create Your Piece</ButtonLink>
        </div>
      ) : (
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-3">
          {artworks.map((piece) => (
            <PieceCard
              key={piece.id}
              href={piece.passport ? `/passport/${piece.passport.publicSlug}` : "#"}
              imageUrl={piece.approvedVersion.imageUrl ?? ""}
              title={piece.approvedVersion.creativeDirection.title}
              garmentLabel={piece.commission.garment.label}
              pieceId={piece.passport?.pieceId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
