"use client";

import { useState } from "react";

export function TagInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const tag = draft.trim();
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setDraft("");
  }

  return (
    <div>
      <label className="label-eyebrow block mb-2 text-ink/60">{label}</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 border border-line px-2 py-1 text-xs"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="text-ink/40 hover:text-rust"
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        placeholder={placeholder}
        className="w-full border border-line bg-transparent px-4 py-3 text-sm outline-none focus:border-rust"
      />
    </div>
  );
}
