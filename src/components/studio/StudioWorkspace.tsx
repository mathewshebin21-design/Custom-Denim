"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/Button";
import { formatDate } from "@/lib/format";

export type WorkspaceDirection = {
  id: string;
  title: string;
  narrative: string;
  colorPalette: string[];
  themes: string[];
  placement: string;
  isSelected: boolean;
};

export type WorkspaceVersion = {
  id: string;
  versionNumber: number;
  status: string;
  imageUrl: string | null;
  customerFeedback: string | null;
  createdAt: string;
  designSpec: {
    silhouetteNotes: string;
    motifs: string[];
    placementDetail: string;
    colorNotes: string;
    materialNotes: string;
    requiredElements: string[];
    elementsToAvoid: string[];
  };
  feasibility: {
    summary: string;
    considerations: string[];
    suggestedAdjustments: string[];
  } | null;
  directionTitle: string;
};

export function StudioWorkspace({
  commissionId,
  commissionStatus,
  directions,
  versions,
  hasArtwork,
}: {
  commissionId: string;
  commissionStatus: string;
  directions: WorkspaceDirection[];
  versions: WorkspaceVersion[];
  hasArtwork: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  const currentVersion = versions[versions.length - 1] ?? null;
  const awaitingDirectionChoice = versions.length === 0;

  async function selectDirection(creativeDirectionId: string) {
    setLoading("select");
    setError(null);
    const res = await fetch(`/api/commissions/${commissionId}/select-direction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creativeDirectionId }),
    });
    setLoading(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong");
      return;
    }
    router.refresh();
  }

  async function requestRevision() {
    if (!feedback.trim()) return;
    setLoading("revise");
    setError(null);
    const res = await fetch(`/api/commissions/${commissionId}/revise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback }),
    });
    setLoading(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong");
      return;
    }
    setFeedback("");
    router.refresh();
  }

  async function approve() {
    if (!currentVersion) return;
    setLoading("approve");
    setError(null);
    const res = await fetch(`/api/commissions/${commissionId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId: currentVersion.id }),
    });
    setLoading(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong");
      return;
    }
    router.push(`/account/commissions/${commissionId}`);
  }

  if (awaitingDirectionChoice) {
    return (
      <div>
        <p className="label-eyebrow text-ink/50 mb-2">Step 2 of 3</p>
        <h2 className="font-display text-3xl mb-4">Choose a direction.</h2>
        <p className="text-ink/70 max-w-xl mb-10">
          These are three genuinely different creative interpretations of
          your story. Pick the one that speaks to you most — you&apos;ll be
          able to refine it from here.
        </p>
        {error && <p className="text-sm text-rust mb-6">{error}</p>}
        <div className="grid gap-8 md:grid-cols-3">
          {directions.map((d) => (
            <div key={d.id} className="border border-line flex flex-col">
              <div className="p-6 flex-1">
                <p className="font-display text-xl mb-3">{d.title}</p>
                <p className="text-sm text-ink/70 mb-4">{d.narrative}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {d.colorPalette.map((c) => (
                    <span key={c} className="text-xs border border-line px-2 py-1">{c}</span>
                  ))}
                </div>
                <p className="text-xs text-ink/50 uppercase tracking-wide">Placement: {d.placement}</p>
              </div>
              <div className="border-t border-line p-4">
                <Button
                  className="w-full"
                  disabled={loading !== null}
                  onClick={() => selectDirection(d.id)}
                >
                  {loading === "select" ? "Loading…" : "Choose This Direction"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!currentVersion) return null;

  const isApproved = commissionStatus !== "in_studio" && commissionStatus !== "revising";

  return (
    <div className="grid gap-16 lg:grid-cols-[1fr_22rem]">
      <div>
        <p className="label-eyebrow text-ink/50 mb-2">
          {isApproved ? "Approved Concept" : "Step 3 of 3 — Refine Your Concept"}
        </p>
        <h2 className="font-display text-3xl mb-6">{currentVersion.directionTitle}</h2>

        <div className="relative aspect-[4/5] max-w-md bg-paper-dim mb-8 overflow-hidden">
          {currentVersion.imageUrl && (
            <Image src={currentVersion.imageUrl} alt={currentVersion.directionTitle} fill unoptimized className="object-cover" />
          )}
        </div>

        <div className="grid gap-6 sm:grid-cols-2 mb-10 text-sm">
          <div>
            <p className="label-eyebrow text-ink/50 mb-2">Silhouette</p>
            <p className="text-ink/70">{currentVersion.designSpec.silhouetteNotes}</p>
          </div>
          <div>
            <p className="label-eyebrow text-ink/50 mb-2">Placement</p>
            <p className="text-ink/70">{currentVersion.designSpec.placementDetail}</p>
          </div>
          <div>
            <p className="label-eyebrow text-ink/50 mb-2">Motifs</p>
            <p className="text-ink/70">{currentVersion.designSpec.motifs.join(", ")}</p>
          </div>
          <div>
            <p className="label-eyebrow text-ink/50 mb-2">Materials</p>
            <p className="text-ink/70">{currentVersion.designSpec.materialNotes}</p>
          </div>
        </div>

        {currentVersion.feasibility && (
          <div className="border border-line p-5 mb-10 text-sm bg-paper-dim/40">
            <p className="label-eyebrow text-denim mb-2">Feasibility Notes — Advisory, Pending Artist Review</p>
            <p className="text-ink/70 mb-3">{currentVersion.feasibility.summary}</p>
            {currentVersion.feasibility.considerations.length > 0 && (
              <ul className="list-disc list-inside text-ink/60 space-y-1">
                {currentVersion.feasibility.considerations.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && <p className="text-sm text-rust mb-4">{error}</p>}

        {!isApproved && (
          <div className="space-y-4 max-w-lg">
            <label className="label-eyebrow block text-ink/60">Request a revision</label>
            <textarea
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="e.g. Can we make the palette warmer, and move the motif to the sleeve?"
              className="w-full border border-line bg-transparent px-4 py-3 text-sm outline-none focus:border-rust"
            />
            <div className="flex flex-wrap gap-4">
              <Button variant="secondary" disabled={loading !== null} onClick={requestRevision}>
                {loading === "revise" ? "Revising…" : "Request Revision"}
              </Button>
              <Button disabled={loading !== null} onClick={approve}>
                {loading === "approve" ? "Approving…" : "Approve This Concept"}
              </Button>
            </div>
          </div>
        )}

        {isApproved && (
          <div className="border-t border-line pt-8">
            <p className="text-sm text-ink/70 mb-4">
              This concept is approved and now moving through production.
            </p>
            <ButtonLink href={`/account/commissions/${commissionId}`}>
              Track Production
            </ButtonLink>
          </div>
        )}
      </div>

      <aside>
        <p className="label-eyebrow text-ink/50 mb-4">Version History</p>
        <ol className="space-y-4">
          {versions.map((v) => (
            <li
              key={v.id}
              className={`border p-4 text-sm ${v.id === currentVersion.id ? "border-ink" : "border-line"}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold">Version {v.versionNumber}</span>
                <span className="text-xs uppercase text-ink/40">{v.status}</span>
              </div>
              <p className="text-xs text-ink/40 mb-2">{formatDate(v.createdAt)}</p>
              {v.customerFeedback && (
                <p className="text-xs text-ink/60 italic">&ldquo;{v.customerFeedback}&rdquo;</p>
              )}
            </li>
          ))}
        </ol>
        {hasArtwork && (
          <p className="mt-6 text-xs text-ink/50">
            <Link href={`/account/commissions/${commissionId}`} className="underline hover:text-rust">
              View full commission →
            </Link>
          </p>
        )}
      </aside>
    </div>
  );
}
