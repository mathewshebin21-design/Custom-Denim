"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ReferenceUploader } from "@/components/studio/ReferenceUploader";

type Artist = { id: string; name: string; capacityStatus: string };

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Something went wrong");
  }
  return res.json();
}

export function AssignArtistPanel({
  commissionId,
  artists,
  assignedArtistId,
}: {
  commissionId: string;
  artists: Artist[];
  assignedArtistId?: string;
}) {
  const router = useRouter();
  const [artistId, setArtistId] = useState(assignedArtistId ?? artists[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await post(`/api/admin/commissions/${commissionId}/assign-artist`, { artistId });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-line p-6">
      <p className="label-eyebrow text-ink/50 mb-4">Artist Assignment</p>
      <select
        value={artistId}
        onChange={(e) => setArtistId(e.target.value)}
        className="w-full border border-line bg-transparent px-4 py-3 text-sm mb-4"
      >
        {artists.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} ({a.capacityStatus})
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-rust mb-2">{error}</p>}
      <Button onClick={submit} disabled={loading || !artistId} className="w-full">
        {loading ? "Saving…" : assignedArtistId ? "Reassign" : "Assign Artist"}
      </Button>
    </div>
  );
}

export function AdvanceStagePanel({
  commissionId,
  stageOptions,
}: {
  commissionId: string;
  stageOptions: string[];
}) {
  const router = useRouter();
  const [stage, setStage] = useState(stageOptions[0] ?? "");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!stage) return;
    setLoading(true);
    setError(null);
    try {
      await post(`/api/admin/commissions/${commissionId}/advance-stage`, { stage, notes: notes || undefined });
      setNotes("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  if (stageOptions.length === 0) {
    return (
      <div className="border border-line p-6">
        <p className="label-eyebrow text-ink/50 mb-2">Production Stage</p>
        <p className="text-sm text-ink/60">All production stages complete.</p>
      </div>
    );
  }

  return (
    <div className="border border-line p-6">
      <p className="label-eyebrow text-ink/50 mb-4">Advance Production Stage</p>
      <select
        value={stage}
        onChange={(e) => setStage(e.target.value)}
        className="w-full border border-line bg-transparent px-4 py-3 text-sm mb-3"
      >
        {stageOptions.map((s) => (
          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
        ))}
      </select>
      <textarea
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Internal notes (optional)"
        className="w-full border border-line bg-transparent px-4 py-3 text-sm mb-3"
      />
      {error && <p className="text-sm text-rust mb-2">{error}</p>}
      <Button onClick={submit} disabled={loading} className="w-full">
        {loading ? "Advancing…" : `Move to "${stage.replace(/_/g, " ")}"`}
      </Button>
    </div>
  );
}

export function ProductionUpdatePanel({ commissionId }: { commissionId: string }) {
  const router = useRouter();
  const [stage, setStage] = useState("painting");
  const [message, setMessage] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!message.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await post(`/api/admin/commissions/${commissionId}/updates`, {
        stage,
        message,
        photoUrl: photoUrls[0],
      });
      setMessage("");
      setPhotoUrls([]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-line p-6">
      <p className="label-eyebrow text-ink/50 mb-4">Post a Progress Update</p>
      <input
        value={stage}
        onChange={(e) => setStage(e.target.value)}
        placeholder="stage label, e.g. painting"
        className="w-full border border-line bg-transparent px-4 py-3 text-sm mb-3"
      />
      <textarea
        rows={2}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Update message the customer will see"
        className="w-full border border-line bg-transparent px-4 py-3 text-sm mb-3"
      />
      <div className="mb-3">
        <ReferenceUploader urls={photoUrls} onChange={setPhotoUrls} />
      </div>
      {error && <p className="text-sm text-rust mb-2">{error}</p>}
      <Button onClick={submit} disabled={loading || !message.trim()} className="w-full">
        {loading ? "Posting…" : "Post Update"}
      </Button>
    </div>
  );
}

export function PaymentPanel({ commissionId, status }: { commissionId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(next: string) {
    setLoading(true);
    setError(null);
    try {
      await post(`/api/admin/commissions/${commissionId}/payment`, { status: next });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-line p-6">
      <p className="label-eyebrow text-ink/50 mb-4">Payment — {status}</p>
      <p className="text-xs text-ink/50 mb-3">
        No live payment gateway is connected in this environment; this marks
        payment status manually.
      </p>
      {error && <p className="text-sm text-rust mb-2">{error}</p>}
      <div className="flex gap-3">
        <Button variant="secondary" disabled={loading} onClick={() => setStatus("succeeded")}>
          Mark Paid
        </Button>
        <Button variant="ghost" disabled={loading} onClick={() => setStatus("refunded")}>
          Mark Refunded
        </Button>
      </div>
    </div>
  );
}

export function ShipmentPanel({
  commissionId,
  carrier: initialCarrier,
  trackingNumber: initialTracking,
}: {
  commissionId: string;
  carrier?: string;
  trackingNumber?: string;
}) {
  const router = useRouter();
  const [carrier, setCarrier] = useState(initialCarrier ?? "");
  const [trackingNumber, setTrackingNumber] = useState(initialTracking ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(extra: { markShipped?: boolean; markDelivered?: boolean } = {}) {
    setLoading(true);
    setError(null);
    try {
      await post(`/api/admin/commissions/${commissionId}/shipment`, { carrier, trackingNumber, ...extra });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-line p-6">
      <p className="label-eyebrow text-ink/50 mb-4">Shipment</p>
      <input
        value={carrier}
        onChange={(e) => setCarrier(e.target.value)}
        placeholder="Carrier"
        className="w-full border border-line bg-transparent px-4 py-3 text-sm mb-3"
      />
      <input
        value={trackingNumber}
        onChange={(e) => setTrackingNumber(e.target.value)}
        placeholder="Tracking number"
        className="w-full border border-line bg-transparent px-4 py-3 text-sm mb-3"
      />
      {error && <p className="text-sm text-rust mb-2">{error}</p>}
      <div className="flex gap-3">
        <Button variant="secondary" disabled={loading} onClick={() => submit()}>
          Save
        </Button>
        <Button variant="secondary" disabled={loading} onClick={() => submit({ markShipped: true })}>
          Mark Shipped
        </Button>
        <Button variant="ghost" disabled={loading} onClick={() => submit({ markDelivered: true })}>
          Mark Delivered
        </Button>
      </div>
    </div>
  );
}

export function PublishPassportPanel({
  commissionId,
  canPublish,
}: {
  commissionId: string;
  canPublish: boolean;
}) {
  const router = useRouter();
  const [materials, setMaterials] = useState("");
  const [finalDescription, setFinalDescription] = useState("");
  const [careInstructions, setCareInstructions] = useState("Spot clean only. Do not machine wash or dry.");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await post(`/api/admin/commissions/${commissionId}/passport`, {
        materials: materials || undefined,
        finalDescription: finalDescription || undefined,
        careInstructions: careInstructions || undefined,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  if (!canPublish) {
    return (
      <div className="border border-line p-6">
        <p className="label-eyebrow text-ink/50 mb-2">Art Passport</p>
        <p className="text-sm text-ink/60">Available once the piece reaches &ldquo;Delivered&rdquo;.</p>
      </div>
    );
  }

  return (
    <div className="border border-line p-6">
      <p className="label-eyebrow text-ink/50 mb-4">Publish Art Passport</p>
      <input
        value={materials}
        onChange={(e) => setMaterials(e.target.value)}
        placeholder="Materials, e.g. cotton denim, acrylic paint, embroidery floss"
        className="w-full border border-line bg-transparent px-4 py-3 text-sm mb-3"
      />
      <textarea
        rows={2}
        value={finalDescription}
        onChange={(e) => setFinalDescription(e.target.value)}
        placeholder="Public description of the piece"
        className="w-full border border-line bg-transparent px-4 py-3 text-sm mb-3"
      />
      <input
        value={careInstructions}
        onChange={(e) => setCareInstructions(e.target.value)}
        placeholder="Care instructions"
        className="w-full border border-line bg-transparent px-4 py-3 text-sm mb-3"
      />
      {error && <p className="text-sm text-rust mb-2">{error}</p>}
      <Button onClick={submit} disabled={loading} className="w-full">
        {loading ? "Publishing…" : "Publish Art Passport"}
      </Button>
    </div>
  );
}
