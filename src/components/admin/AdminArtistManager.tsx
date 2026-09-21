"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { TagInput } from "@/components/studio/TagInput";

type Artist = {
  id: string;
  name: string;
  bio: string | null;
  photoUrl: string | null;
  styleTagsJson: string;
  capacityStatus: string;
};

const CAPACITY_OPTIONS = ["available", "limited", "full"];

/**
 * Full CRUD for artists: create, inline bio/capacity edits, a style-tag
 * editor, and a photo upload per artist. Mirrors AdminProductManager.tsx's
 * conventions (server-confirmed state, no speculative local-only edits)
 * since the same "stale admin state directly drives what's shown publicly"
 * reasoning applies — this data renders on the public /artists page.
 */
export function AdminArtistManager({ initialArtists }: { initialArtists: Artist[] }) {
  const [artists, setArtists] = useState(initialArtists);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ email: "", name: "", bio: "", capacityStatus: "available" });
  const [styleTags, setStyleTags] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  async function createArtist() {
    setError(null);
    if (!form.email.trim() || !form.name.trim()) {
      setError("Email and name are required.");
      return;
    }
    setCreating(true);
    const res = await fetch("/api/admin/artists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email,
        name: form.name,
        bio: form.bio || undefined,
        styleTags,
        capacityStatus: form.capacityStatus,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Could not create artist");
    } else {
      setArtists((prev) => [...prev, body.artist]);
      setForm({ email: "", name: "", bio: "", capacityStatus: "available" });
      setStyleTags([]);
    }
    setCreating(false);
  }

  async function patchArtist(id: string, data: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/admin/artists/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Could not update artist");
      return;
    }
    setArtists((prev) => prev.map((a) => (a.id === id ? { ...a, ...body.artist } : a)));
  }

  async function deleteArtist(id: string) {
    if (!confirm("Delete this artist? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/artists/${id}`, { method: "DELETE" });
    if (res.ok) setArtists((prev) => prev.filter((a) => a.id !== id));
  }

  async function uploadPhoto(artistId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("artistId", artistId);
    const uploadRes = await fetch("/api/admin/artists/upload-photo", { method: "POST", body: formData });
    const uploadBody = await uploadRes.json().catch(() => ({}));
    if (!uploadRes.ok) {
      setError(uploadBody.error ?? "Could not upload photo");
      return;
    }
    await patchArtist(artistId, { photoUrl: uploadBody.url });
  }

  return (
    <div>
      {error && <p className="text-sm text-rust mb-6">{error}</p>}

      <div className="border border-line p-6 mb-12">
        <p className="label-eyebrow mb-4">Add an Artist</p>
        <div className="grid gap-4 sm:grid-cols-2 mb-4">
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="border border-line px-3 py-2 text-sm"
          />
          <input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="border border-line px-3 py-2 text-sm"
          />
          <select
            value={form.capacityStatus}
            onChange={(e) => setForm({ ...form, capacityStatus: e.target.value })}
            className="border border-line px-3 py-2 text-sm bg-paper"
          >
            {CAPACITY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <textarea
            placeholder="Bio"
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            className="border border-line px-3 py-2 text-sm sm:col-span-2"
            rows={3}
          />
        </div>
        <div className="mb-4">
          <TagInput label="Style Tags" placeholder="Type a tag, press Enter" value={styleTags} onChange={setStyleTags} />
        </div>
        <Button disabled={creating} onClick={createArtist}>
          {creating ? "Adding…" : "Add Artist"}
        </Button>
      </div>

      <div className="divide-y divide-line border-t border-b border-line">
        {artists.map((artist) => {
          const tags: string[] = JSON.parse(artist.styleTagsJson || "[]");
          return (
            <div key={artist.id} className="flex items-start gap-4 py-4">
              <div className="h-16 w-16 bg-paper-dim flex-shrink-0 relative overflow-hidden rounded-full">
                {artist.photoUrl && (
                  <Image src={artist.photoUrl} alt={artist.name} fill sizes="64px" className="object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{artist.name}</p>
                <textarea
                  defaultValue={artist.bio ?? ""}
                  onBlur={(e) => patchArtist(artist.id, { bio: e.target.value })}
                  className="w-full border border-line px-2 py-1.5 text-xs mt-2"
                  rows={2}
                  placeholder="Bio"
                />
                <div className="flex flex-wrap gap-1 mt-2">
                  {tags.map((t) => (
                    <span key={t} className="label-eyebrow text-[10px] border border-line px-2 py-1 text-ink/60">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <select
                defaultValue={artist.capacityStatus}
                onChange={(e) => patchArtist(artist.id, { capacityStatus: e.target.value })}
                className="border border-line px-2 py-1.5 text-sm bg-paper flex-shrink-0"
              >
                {CAPACITY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <label className="text-xs text-ink/50 hover:text-rust cursor-pointer uppercase tracking-widest flex-shrink-0">
                Photo
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadPhoto(artist.id, file);
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                onClick={() => deleteArtist(artist.id)}
                className="text-xs text-ink/50 hover:text-rust uppercase tracking-widest flex-shrink-0"
              >
                Delete
              </button>
            </div>
          );
        })}
        {artists.length === 0 && <p className="py-12 text-center text-ink/50">No artists yet.</p>}
      </div>
    </div>
  );
}
