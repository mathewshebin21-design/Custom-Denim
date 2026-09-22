"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

type AssistantAction =
  | {
      type: "create_product";
      title: string;
      category: string;
      brand?: string;
      description: string;
      size?: string;
      condition: string;
      source: string;
      priceCents: number;
      compareAtPriceCents?: number;
      currency: string;
      quantity: number;
    }
  | {
      type: "update_product";
      id: string;
      title?: string;
      priceCents?: number;
      compareAtPriceCents?: number | null;
      currency?: string;
      quantity?: number;
      active?: boolean;
    }
  | { type: "delete_product"; id: string }
  | { type: "bulk_update_stock"; updates: { id: string; title: string; quantity: number }[] }
  | {
      type: "bulk_create_size_variants";
      templateProductId: string;
      templateTitle: string;
      items: { size: string; quantity: number }[];
    }
  | {
      type: "bulk_apply_discount";
      updates: { id: string; title: string; priceCents: number; compareAtPriceCents: number }[];
    }
  | {
      type: "bulk_create_products";
      items: {
        title: string;
        category: string;
        brand?: string;
        description: string;
        size?: string;
        condition: string;
        source: string;
        priceCents: number;
        currency: string;
        quantity: number;
      }[];
    };

type DisplayMessage =
  | { id: string; role: "user"; kind: "text"; text: string; createdAt: string }
  | { id: string; role: "assistant"; kind: "text"; text: string; createdAt: string }
  | {
      id: string;
      role: "assistant";
      kind: "proposal";
      summary: string;
      action: AssistantAction;
      status: "pending" | "confirmed" | "cancelled" | "error";
      errorText?: string | null;
      createdAt: string;
      // Set once a create_product proposal is confirmed, so the newly
      // created product's id is on hand for the inline photo/video
      // uploads below — there's no other way to attach media to a
      // product that didn't exist until this exact confirm click. Not
      // persisted server-side — a page reload loses just this one
      // convenience, not the confirmed proposal itself.
      createdProductId?: string;
      mediaNote?: string;
      // Same idea as createdProductId, for a bulk_create_products
      // confirmation — one entry per successfully created item, each with
      // its own upload state, so a batch of new products can get photos
      // right in the chat instead of a trip to the Shop admin page.
      createdItems?: { title: string; size?: string; productId: string; mediaNote?: string }[];
    };

type ProposalMessage = Extract<DisplayMessage, { kind: "proposal" }>;

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (sameDay) return time;
  return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
}

function newId(): string {
  return Math.random().toString(36).slice(2);
}

/**
 * A floating chat widget on every /admin page (mounted once in
 * AdminLayout). It can answer questions by reading real store data, and can
 * propose catalog changes — but every proposal is a Confirm/Cancel step,
 * not an immediate write. See src/lib/ai/adminAssistant.ts for the model
 * side and src/app/api/admin/assistant/execute/route.ts for what actually
 * runs a confirmed action (through the same validation as the manual UI).
 *
 * The conversation is persisted per admin (src/lib/ai/assistantHistory.ts)
 * and hydrated here on first open — a reload or a brand-new session picks
 * the same thread back up rather than starting empty every time.
 */
export function AdminAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!open || fetchedRef.current) return;
    fetchedRef.current = true;
    fetch("/api/admin/assistant")
      .then((res) => res.json())
      .then((body) => {
        if (Array.isArray(body.messages)) setMessages(body.messages);
      })
      .catch(() => {
        // History failing to load isn't fatal — the widget still works for
        // a fresh conversation, it just won't have past turns as context.
      })
      .finally(() => {
        setHydrated(true);
        scrollToBottom();
      });
  }, [open]);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  function updateMessage(id: string, patch: Partial<ProposalMessage>) {
    setMessages((prev) => prev.map((m) => (m.id === id && m.kind === "proposal" ? { ...m, ...patch } : m)));
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    const userMessage: DisplayMessage = {
      id: newId(),
      role: "user",
      kind: "text",
      text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    scrollToBottom();
    setLoading(true);

    // A slow tool-calling turn can still outlast the request (a dropped
    // connection, a proxy timeout) even with the route's own maxDuration —
    // wrapped so that case surfaces as a real error instead of leaving the
    // chat stuck on "Thinking…" forever with setLoading(false) never reached.
    try {
      const res = await fetch("/api/admin/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(body.error ?? "Something went wrong");
        return;
      }

      const createdAt = body.createdAt ?? new Date().toISOString();
      if (body.kind === "proposal") {
        setMessages((prev) => [
          ...prev,
          { id: body.id, role: "assistant", kind: "proposal", summary: body.summary, action: body.action, status: "pending", createdAt },
        ]);
      } else {
        setMessages((prev) => [...prev, { id: body.id, role: "assistant", kind: "text", text: body.text, createdAt }]);
      }
      scrollToBottom();
    } catch {
      setError("Lost connection while waiting for a reply — it may have taken too long. Try again, or ask a narrower question.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmProposal(id: string) {
    const message = messages.find((m) => m.id === id);
    if (!message || message.kind !== "proposal") return;

    let res: Response;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- same untyped response-body pattern as send() above
    let body: any;
    try {
      res = await fetch("/api/admin/assistant/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: id, action: message.action }),
      });
      body = await res.json().catch(() => ({}));
    } catch {
      updateMessage(id, { status: "error", errorText: "Lost connection while applying this — check the catalog before retrying, it may have partially applied." });
      return;
    }

    if (!res.ok) {
      updateMessage(id, { status: "error", errorText: body.error ?? "Could not apply this change" });
      return;
    }
    const createdItems =
      message.action.type === "bulk_create_products"
        ? (Array.isArray(body.outcomes) ? body.outcomes : [])
            // Only items that actually got created carry a productId —
            // a partial failure still lets the rest get photos.
            .filter((o: { ok?: boolean; productId?: string }) => o.ok && o.productId)
            .map((o: { title: string; size?: string; productId: string }) => ({
              title: o.title,
              size: o.size,
              productId: o.productId,
            }))
        : undefined;

    updateMessage(id, {
      status: "confirmed",
      createdProductId: message.action.type === "create_product" ? body.product?.id : undefined,
      createdItems,
    });
  }

  async function cancelProposal(id: string) {
    updateMessage(id, { status: "cancelled" });
    await fetch(`/api/admin/assistant/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    }).catch(() => {
      // Best-effort — the local state already reflects "cancelled" either way.
    });
  }

  async function attachPhoto(messageId: string, productId: string, file: File) {
    updateMessage(messageId, { mediaNote: "Uploading photo…" });
    const formData = new FormData();
    formData.append("file", file);
    formData.append("productId", productId);
    const uploadRes = await fetch("/api/admin/products/upload", { method: "POST", body: formData });
    const uploadBody = await uploadRes.json().catch(() => ({}));
    if (!uploadRes.ok) {
      updateMessage(messageId, { mediaNote: uploadBody.error ?? "Could not upload photo" });
      return;
    }
    const attachRes = await fetch(`/api/admin/products/${productId}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: uploadBody.url }),
    });
    if (!attachRes.ok) {
      const attachBody = await attachRes.json().catch(() => ({}));
      updateMessage(messageId, { mediaNote: attachBody.error ?? "Could not attach photo" });
      return;
    }
    updateMessage(messageId, { mediaNote: "Photo added." });
  }

  async function attachVideo(messageId: string, productId: string, file: File) {
    updateMessage(messageId, { mediaNote: "Uploading video…" });
    const formData = new FormData();
    formData.append("file", file);
    formData.append("productId", productId);
    const uploadRes = await fetch("/api/admin/products/upload-video", { method: "POST", body: formData });
    const uploadBody = await uploadRes.json().catch(() => ({}));
    if (!uploadRes.ok) {
      updateMessage(messageId, { mediaNote: uploadBody.error ?? "Could not upload video" });
      return;
    }
    const patchRes = await fetch(`/api/admin/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoUrl: uploadBody.url }),
    });
    if (!patchRes.ok) {
      const patchBody = await patchRes.json().catch(() => ({}));
      updateMessage(messageId, { mediaNote: patchBody.error ?? "Could not attach video" });
      return;
    }
    updateMessage(messageId, { mediaNote: "Video added." });
  }

  function updateItemNote(messageId: string, productId: string, note: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.kind === "proposal" && m.createdItems
          ? { ...m, createdItems: m.createdItems.map((it) => (it.productId === productId ? { ...it, mediaNote: note } : it)) }
          : m,
      ),
    );
  }

  async function attachPhotoToItem(messageId: string, productId: string, file: File) {
    updateItemNote(messageId, productId, "Uploading photo…");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("productId", productId);
    const uploadRes = await fetch("/api/admin/products/upload", { method: "POST", body: formData });
    const uploadBody = await uploadRes.json().catch(() => ({}));
    if (!uploadRes.ok) {
      updateItemNote(messageId, productId, uploadBody.error ?? "Could not upload photo");
      return;
    }
    const attachRes = await fetch(`/api/admin/products/${productId}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: uploadBody.url }),
    });
    if (!attachRes.ok) {
      const attachBody = await attachRes.json().catch(() => ({}));
      updateItemNote(messageId, productId, attachBody.error ?? "Could not attach photo");
      return;
    }
    updateItemNote(messageId, productId, "Photo added.");
  }

  async function attachVideoToItem(messageId: string, productId: string, file: File) {
    updateItemNote(messageId, productId, "Uploading video…");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("productId", productId);
    const uploadRes = await fetch("/api/admin/products/upload-video", { method: "POST", body: formData });
    const uploadBody = await uploadRes.json().catch(() => ({}));
    if (!uploadRes.ok) {
      updateItemNote(messageId, productId, uploadBody.error ?? "Could not upload video");
      return;
    }
    const patchRes = await fetch(`/api/admin/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoUrl: uploadBody.url }),
    });
    if (!patchRes.ok) {
      const patchBody = await patchRes.json().catch(() => ({}));
      updateItemNote(messageId, productId, patchBody.error ?? "Could not attach video");
      return;
    }
    updateItemNote(messageId, productId, "Video added.");
  }

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {open && (
        <div className="mb-3 w-[22rem] max-w-[calc(100vw-3rem)] border border-line bg-paper shadow-xl flex flex-col" style={{ height: "28rem" }}>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="label-eyebrow text-ink/70">Admin Assistant</p>
            <button onClick={() => setOpen(false)} className="text-ink/50 hover:text-rust text-sm" aria-label="Close">
              ✕
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {hydrated && messages.length === 0 && (
              <p className="text-xs text-ink/50">
                Ask about stock, sales, or orders — or tell me to add, edit, or remove a product. I&apos;ll show you the
                exact change before anything is saved. New products can get photos and a video right after you confirm.
              </p>
            )}
            {messages.map((m) => {
              if (m.role === "user") {
                return (
                  <div key={m.id} className="ml-8">
                    <div className="border border-line bg-paper-dim/40 px-3 py-2 text-sm">{m.text}</div>
                    <p className="text-[10px] text-ink/40 mt-1 text-right">{formatTimestamp(m.createdAt)}</p>
                  </div>
                );
              }
              if (m.kind === "proposal") {
                return (
                  <div key={m.id} className="mr-4">
                    <div className="border border-rust/50 px-3 py-3 text-sm">
                      <p className="mb-3 whitespace-pre-wrap">{m.summary}</p>
                      {m.status === "pending" && (
                        <div className="flex gap-2">
                          <Button onClick={() => confirmProposal(m.id)} className="text-xs px-3 py-1.5">
                            Confirm
                          </Button>
                          <button
                            onClick={() => cancelProposal(m.id)}
                            className="label-eyebrow text-xs text-ink/50 hover:text-rust px-3 py-1.5"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      {m.status === "confirmed" && (
                        <div>
                          <p className="text-xs text-ink/50 uppercase tracking-widest mb-2">Done</p>
                          {m.action.type === "create_product" && m.createdProductId && (
                            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-2 mt-2">
                              <label className="text-xs text-ink/50 hover:text-rust cursor-pointer uppercase tracking-widest">
                                Add Photo
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file && m.createdProductId) attachPhoto(m.id, m.createdProductId, file);
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                              <label className="text-xs text-ink/50 hover:text-rust cursor-pointer uppercase tracking-widest">
                                Add Video
                                <input
                                  type="file"
                                  accept="video/mp4,video/quicktime"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file && m.createdProductId) attachVideo(m.id, m.createdProductId, file);
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                            </div>
                          )}
                          {m.mediaNote && <p className="text-xs text-ink/50 mt-2">{m.mediaNote}</p>}
                          {m.action.type === "bulk_create_products" && m.createdItems && m.createdItems.length > 0 && (
                            <div className="border-t border-line pt-2 mt-2 space-y-2">
                              {m.createdItems.map((item) => (
                                <div key={item.productId} className="flex flex-wrap items-center gap-3">
                                  <p className="text-xs text-ink/70 flex-1 min-w-0 truncate">
                                    {item.title}
                                    {item.size ? ` (${item.size})` : ""}
                                  </p>
                                  <label className="text-xs text-ink/50 hover:text-rust cursor-pointer uppercase tracking-widest">
                                    Photo
                                    <input
                                      type="file"
                                      accept="image/png,image/jpeg,image/webp"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) attachPhotoToItem(m.id, item.productId, file);
                                        e.target.value = "";
                                      }}
                                    />
                                  </label>
                                  <label className="text-xs text-ink/50 hover:text-rust cursor-pointer uppercase tracking-widest">
                                    Video
                                    <input
                                      type="file"
                                      accept="video/mp4,video/quicktime"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) attachVideoToItem(m.id, item.productId, file);
                                        e.target.value = "";
                                      }}
                                    />
                                  </label>
                                  {item.mediaNote && <p className="text-[10px] text-ink/50 w-full">{item.mediaNote}</p>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {m.status === "cancelled" && (
                        <p className="text-xs text-ink/50 uppercase tracking-widest">Cancelled</p>
                      )}
                      {m.status === "error" && <p className="text-xs text-rust whitespace-pre-wrap">{m.errorText}</p>}
                    </div>
                    <p className="text-[10px] text-ink/40 mt-1">{formatTimestamp(m.createdAt)}</p>
                  </div>
                );
              }
              return (
                <div key={m.id} className="mr-4">
                  <div className="text-sm text-ink/80 whitespace-pre-wrap">{m.text}</div>
                  <p className="text-[10px] text-ink/40 mt-1">{formatTimestamp(m.createdAt)}</p>
                </div>
              );
            })}
            {loading && <p className="text-xs text-ink/40">Thinking…</p>}
          </div>

          {error && <p className="px-4 pb-2 text-xs text-rust">{error}</p>}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex gap-2 border-t border-line p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask or tell me what to change…"
              className="flex-1 min-w-0 border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-rust"
            />
            <Button type="submit" disabled={loading} className="text-xs px-3">
              Send
            </Button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="label-eyebrow text-xs bg-ink text-paper px-5 py-3 shadow-lg hover:bg-rust"
      >
        {open ? "Close" : "Assistant"}
      </button>
    </div>
  );
}
