"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function LoginForm({ next }: { next: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong");
      return;
    }
    const body = await res.json();
    // Full reload (not router.push) so the header's session check re-renders
    // with the new cookie instead of racing a client-side transition.
    window.location.href = next ?? (body.user.role === "admin" ? "/admin" : "/account");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-sm">
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
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-line bg-transparent px-4 py-3 text-sm outline-none focus:border-rust"
        />
      </div>
      {error && <p className="text-sm text-rust">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Signing in…" : "Sign In"}
      </Button>
      <p className="text-sm text-ink/60">
        No account yet?{" "}
        <Link href="/register" className="text-ink underline hover:text-rust">
          Create one
        </Link>
      </p>
    </form>
  );
}
