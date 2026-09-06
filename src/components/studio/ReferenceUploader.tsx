"use client";

import { useRef, useState } from "react";
import Image from "next/image";

export function ReferenceUploader({
  urls,
  onChange,
  commissionId,
}: {
  urls: string[];
  onChange: (urls: string[]) => void;
  /** Pass this when the upload is for an existing commission (e.g. an admin
   * production update) so the server can associate and authorize it; omit
   * it for pre-commission Studio intake, where no commission exists yet. */
  commissionId?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    const uploaded: string[] = [];
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
      uploaded.push(body.url);
    }
    setUploading(false);
    onChange([...urls, ...uploaded]);
  }

  return (
    <div>
      <label className="label-eyebrow block mb-2 text-ink/60">Reference Images (optional)</label>
      <div className="flex flex-wrap gap-3 mb-3">
        {urls.map((url) => (
          <div key={url} className="relative h-20 w-20 border border-line">
            <Image src={url} alt="Reference" fill className="object-cover" unoptimized />
            <button
              type="button"
              onClick={() => onChange(urls.filter((u) => u !== url))}
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
