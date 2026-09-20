"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

/**
 * Not linked from anywhere in the site's nav — reachable only by whoever
 * has the ADMIN_SETUP_TOKEN. It self-disables server-side (see
 * /api/admin/bootstrap) the moment an admin account exists, so this form
 * being publicly reachable at all only matters for the single narrow
 * window before that first admin is created.
 */
export function AdminBootstrapForm() {
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name, email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="max-w-sm">
        <p className="font-display text-xl mb-4">Admin account created.</p>
        <p className="text-sm text-ink/70 mb-6">
          Sign in with the email and password you just set. This setup page will refuse to create
          another admin account from now on.
        </p>
        <Link href="/login" className="text-ink underline hover:text-rust text-sm">
          Go to Sign In →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-sm">
      <div>
        <label className="label-eyebrow block mb-2 text-ink/60">Setup Token</label>
        <input
          required
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="w-full border border-line bg-transparent px-4 py-3 text-sm outline-none focus:border-rust"
        />
      </div>
      <div>
        <label className="label-eyebrow block mb-2 text-ink/60">Name</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-line bg-transparent px-4 py-3 text-sm outline-none focus:border-rust"
        />
      </div>
      <div>
        <label className="label-eyebrow block mb-2 text-ink/60">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-line bg-transparent px-4 py-3 text-sm outline-none focus:border-rust"
        />
      </div>
      <div>
        <label className="label-eyebrow block mb-2 text-ink/60">Password</label>
        <input
          type="password"
          required
          minLength={12}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-line bg-transparent px-4 py-3 text-sm outline-none focus:border-rust"
        />
        <p className="text-xs text-ink/40 mt-1">At least 12 characters. This is your only admin account.</p>
      </div>
      {error && <p className="text-sm text-rust">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Creating…" : "Create Admin Account"}
      </Button>
    </form>
  );
}
