import { db } from "@/lib/db";
import { ButtonLink } from "@/components/ui/Button";
import { PieceCard } from "@/components/art/PieceCard";

async function getFeaturedPieces() {
  const artworks = await db.artwork.findMany({
    where: { completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
    take: 3,
    include: {
      commission: { include: { garment: true } },
      approvedVersion: { include: { creativeDirection: true } },
      passport: true,
    },
  });
  return artworks;
}

export default async function HomePage() {
  const pieces = await getFeaturedPieces();

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 bg-gradient-to-br from-denim/20 via-transparent to-rust/20" />
        <div className="container-editorial relative py-28 md:py-40">
          <p className="label-eyebrow text-rust mb-6">AI-Designed. Artist-Made. One-of-One.</p>
          <h1 className="font-display text-5xl md:text-7xl leading-[1.05] max-w-4xl">
            Wear your story.
          </h1>
          <p className="mt-8 max-w-xl text-lg text-ink/75">
            Your story becomes an original piece of wearable art — designed
            with AI, created by human artists, made once for you.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <ButtonLink href="/create">Create Your Piece</ButtonLink>
            <ButtonLink href="/art" variant="secondary">
              Explore the Art
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container-editorial py-24 border-b border-line">
        <p className="label-eyebrow text-ink/50 mb-4">How It Works</p>
        <div className="grid gap-12 md:grid-cols-3">
          <div>
            <p className="font-display text-4xl text-rust mb-4">01</p>
            <h3 className="font-display text-xl mb-2">Tell your story</h3>
            <p className="text-sm text-ink/70">
              Describe a memory, a place, a feeling — whatever the piece
              should carry. Upload references if you have them. Our AI
              Creative Director listens and asks the right questions.
            </p>
          </div>
          <div>
            <p className="font-display text-4xl text-rust mb-4">02</p>
            <h3 className="font-display text-xl mb-2">Shape the concept</h3>
            <p className="text-sm text-ink/70">
              You&apos;ll receive three distinct creative directions. Pick
              one, refine it in plain language, and approve the concept when
              it feels right.
            </p>
          </div>
          <div>
            <p className="font-display text-4xl text-rust mb-4">03</p>
            <h3 className="font-display text-xl mb-2">A human artist makes it</h3>
            <p className="text-sm text-ink/70">
              Your approved concept becomes a production brief for a real
              artist, who hand-paints, embroiders, or otherwise physically
              creates your one-of-one piece — with photos along the way.
            </p>
          </div>
        </div>
      </section>

      {/* AI + Artist positioning */}
      <section className="container-editorial py-24 border-b border-line grid gap-12 md:grid-cols-2">
        <div>
          <p className="label-eyebrow text-denim mb-4">The AI</p>
          <h3 className="font-display text-2xl mb-4">Your Creative Director</h3>
          <p className="text-sm text-ink/70">
            The AI listens to your story, develops concepts, helps you
            refine them through natural conversation, and translates the
            approved idea into a structured brief. It never claims to paint,
            sew, or physically make anything — and every concept is clearly
            marked as a concept until an artist has reviewed it.
          </p>
        </div>
        <div>
          <p className="label-eyebrow text-rust mb-4">The Artist</p>
          <h3 className="font-display text-2xl mb-4">The maker of your piece</h3>
          <p className="text-sm text-ink/70">
            A human artist has final artistic judgment on every piece —
            reviewing feasibility, preparing the garment, sketching,
            painting, embroidering, and finishing every detail by hand. AI
            designs the direction; the artist creates the object.
          </p>
        </div>
      </section>

      {/* Featured pieces */}
      <section className="container-editorial py-24">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="label-eyebrow text-ink/50 mb-4">Recently Completed</p>
            <h2 className="font-display text-3xl">One-of-one pieces</h2>
          </div>
          <ButtonLink href="/art" variant="ghost">
            View all →
          </ButtonLink>
        </div>

        {pieces.length === 0 ? (
          <div className="border border-dashed border-line py-20 text-center">
            <p className="font-display text-xl mb-2">The first pieces are in production.</p>
            <p className="text-sm text-ink/60 max-w-md mx-auto">
              We&apos;re a young studio — the gallery fills in as commissions
              are completed. Be among the first to commission an original
              piece.
            </p>
          </div>
        ) : (
          <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-3">
            {pieces.map((piece) => (
              <PieceCard
                key={piece.id}
                href={piece.passport ? `/passport/${piece.passport.publicSlug}` : "/art"}
                imageUrl={piece.approvedVersion.imageUrl ?? ""}
                title={piece.approvedVersion.creativeDirection.title}
                garmentLabel={piece.commission.garment.label}
                pieceId={piece.passport?.pieceId}
              />
            ))}
          </div>
        )}
      </section>

      {/* Closing CTA */}
      <section className="border-t border-line bg-ink text-paper">
        <div className="container-editorial py-24 text-center">
          <h2 className="font-display text-4xl mb-6">Ready to wear your story?</h2>
          <ButtonLink href="/create" className="!bg-paper !text-ink hover:!bg-rust hover:!text-paper">
            Create Your Piece
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
