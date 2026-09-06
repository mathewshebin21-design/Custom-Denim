import Link from "next/link";
import Image from "next/image";

export function PieceCard({
  href,
  imageUrl,
  title,
  garmentLabel,
  artistName,
  pieceId,
}: {
  href: string;
  imageUrl: string;
  title: string;
  garmentLabel: string;
  artistName?: string;
  pieceId?: string;
}) {
  return (
    <Link href={href} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden bg-paper-dim">
        <Image
          src={imageUrl}
          alt={title}
          fill
          unoptimized
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </div>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-lg">{title}</p>
          <p className="text-sm text-ink/60">
            {garmentLabel}
            {artistName ? ` · ${artistName}` : ""}
          </p>
        </div>
        {pieceId && <p className="label-eyebrow text-ink/40 shrink-0">{pieceId}</p>}
      </div>
    </Link>
  );
}
