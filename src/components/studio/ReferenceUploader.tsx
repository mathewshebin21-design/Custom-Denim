"use client";

import { useRef, useState } from "react";
import Image from "next/image";

/**
 * `urls`/`onChange` carry storage object *keys*, not display URLs — kept
 * under these established prop names since neither caller (StudioIntakeForm,
 * AdminCommissionActions) ever renders them directly; both just collect and
 * submit them onward (as `referenceImageUrls` / `photoUrl`) to be persisted.
 * Keys are stable; the signed preview URL returned alongside each upload is
 * not, and is only ever kept in this component's own local state for
 * rendering thumbnails — never passed up to the parent.
 */
export function ReferenceUploader({
  urls,
  onChange,
  commissionId,
}: {
  urls: string[];
  onChange: (keys: string[]) => void;
  /** Pass this when the upload is for an existing commission (e.g. an admin
   * production update) so the server can associate and authorize it; omit
   * it for pre-commission Studio intake, where no commission exists yet. */
  commissionId?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    const uploadedKeys: string[] = [];
    const newPreviews: Record<string, string> = {};
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      if (commissionId) formData.append("commissionId", commissionId);
      const res = await fetch("/api/uploads", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Upload failed");
        continue;
      }
      const body = await res.json();
      uploadedKeys.push(body.key);
      newPreviews[body.key] = body.url;
    }
    setUploading(false);
    setPreviewUrls((prev) => ({ ...prev, ...newPreviews }));
    onChange([...urls, ...uploadedKeys]);
  }

  function remove(key: string) {
    onChange(urls.filter((k) => k !== key));
    setPreviewUrls((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  return (
    <div>
      <label className="label-eyebrow block mb-2 text-ink/60">Reference Images (optional)</label>
      <div className="flex flex-wrap gap-3 mb-3">
        {urls.map((key) => (
          <div key={key} className="relative h-20 w-20 border border-line">
            {previewUrls[key] && (
              <Image src={previewUrls[key]} alt="Reference" fill className="object-cover" unoptimized />
            )}
            <button
              type="button"
              onClick={() => remove(key)}
              className="absolute -top-2 -right-2 h-5 w-5 bg-ink text-paper text-xs"
              aria-label="Remove image"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="h-20 w-20 border border-dashed border-line text-xs text-ink/50 hover:border-rust hover:text-rust"
          disabled={uploading}
        >
          {uploading ? "Uploading…" : "+ Add"}
        </button>
      </div>
      {error && <p className="text-xs text-rust">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
