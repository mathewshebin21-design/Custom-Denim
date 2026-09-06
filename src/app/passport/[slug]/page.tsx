import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";

async function getPassport(slug: string) {
  return db.artPassport.findUnique({
    where: { publicSlug: slug },
    include: {
      artwork: {
        include: {
          commission: {
            include: {
              garment: true,
              artistAssignment: { include: { artist: true } },
              productionUpdates: { orderBy: { createdAt: "asc" } },
            },
          },
          approvedVersion: { include: { creativeDirection: true } },
        },
      },
    },
  });
}

export async function generateMetadata(props: PageProps<"/passport/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const passport = await getPassport(slug);
  if (!passport) return { title: "Art Passport" };
  return {
    title: `${passport.pieceId} — Art Passport`,
    description: passport.authenticityStatement ?? "A one-of-one wearable art piece.",
  };
}

export default async function PassportPage(props: PageProps<"/passport/[slug]">) {
  const { slug } = await props.params;
  const passport = await getPassport(slug);
  if (!passport) notFound();

  const { artwork } = passport;
  const { commission } = artwork;
  const direction = artwork.approvedVersion.creativeDirection;
  const palette: string[] = JSON.parse(direction.colorPalette || "[]");
  const artistAssignment = commission.artistAssignment;

  return (
    <div className="container-editorial py-24">
      <p className="label-eyebrow text-rust mb-4">Art Passport</p>
      <div className="grid gap-16 md:grid-cols-2">
        <div>
          <div className="relative aspect-[4/5] bg-paper-dim overflow-hidden">
            <Image
              src={artwork.approvedVersion.imageUrl ?? ""}
              alt={direction.title}
              fill
              unoptimized
              className="object-cover"
            />
          </div>
        </div>

        <div>
          <h1 className="font-display text-4xl mb-2">{direction.title}</h1>
          <p className="text-ink/60 mb-8">{commission.garment.label}</p>

          <dl className="space-y-4 text-sm mb-10">
            <div className="flex justify-between border-b border-line pb-2">
              <dt className="text-ink/50">Piece ID</dt>
              <dd className="font-semibold">{passport.pieceId}</dd>
            </div>
            {artistAssignment && (
              <div className="flex justify-between border-b border-line pb-2">
                <dt className="text-ink/50">Artist</dt>
                <dd>{artistAssignment.artist.name}</dd>
              </div>
            )}
            <div className="flex justify-between border-b border-line pb-2">
              <dt className="text-ink/50">Completed</dt>
              <dd>{artwork.completedAt ? formatDate(artwork.completedAt) : "—"}</dd>
            </div>
            {artwork.materials && (
              <div className="flex justify-between border-b border-line pb-2">
                <dt className="text-ink/50">Materials</dt>
                <dd className="text-right max-w-[60%]">{artwork.materials}</dd>
              </div>
            )}
          </dl>

          {artwork.finalDescription && (
            <div className="mb-10">
              <p className="label-eyebrow text-ink/50 mb-2">About This Piece</p>
              <p className="text-sm text-ink/70">{artwork.finalDescription}</p>
            </div>
          )}

          <div className="mb-10">
            <p className="label-eyebrow text-ink/50 mb-3">Palette</p>
            <div className="flex flex-wrap gap-2 text-xs">
              {palette.map((c) => (
                <span key={c} className="border border-line px-2 py-1">{c}</span>
              ))}
            </div>
          </div>

          {passport.careInstructions && (
            <div className="mb-10">
              <p className="label-eyebrow text-ink/50 mb-2">Care</p>
              <p className="text-sm text-ink/70">{passport.careInstructions}</p>
            </div>
          )}

          {passport.qrCodeDataUrl && (
            <div className="flex items-center gap-4 border-t border-line pt-8">
              <Image src={passport.qrCodeDataUrl} alt="Verification QR code" width={96} height={96} unoptimized />
              <p className="text-xs text-ink/50 max-w-xs">
                {passport.authenticityStatement ??
                  "This QR code verifies this piece's authenticity and links back to this Art Passport."}
              </p>
            </div>
          )}
        </div>
      </div>

      {commission.productionUpdates.length > 0 && (
        <div className="mt-24 border-t border-line pt-12">
          <p className="label-eyebrow text-ink/50 mb-8">Production History</p>
          <div className="space-y-8 max-w-2xl">
            {commission.productionUpdates.map((u) => (
              <div key={u.id} className="flex gap-6">
                <p className="w-32 shrink-0 text-xs text-ink/40 uppercase tracking-wide pt-1">
                  {formatDate(u.createdAt)}
                </p>
                <div>
                  <p className="text-sm font-semibold mb-1">{u.stage.replace(/_/g, " ")}</p>
                  <p className="text-sm text-ink/70">{u.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
