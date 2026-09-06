"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function RegisterForm({ next }: { next: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong");
      return;
    }
    // Full reload (not router.push) so the header's session check re-renders
    // with the new cookie instead of racing a client-side transition.
    window.location.href = next;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-sm">
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
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-line bg-transparent px-4 py-3 text-sm outline-none focus:border-rust"
        />
        <p className="text-xs text-ink/40 mt-1">At least 8 characters.</p>
      </div>
      {error && <p className="text-sm text-rust">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Creating account…" : "Create Account"}
      </Button>
      <p className="text-sm text-ink/60">
        Already have an account?{" "}
        <Link href="/login" className="text-ink underline hover:text-rust">
          Sign in
        </Link>
      </p>
    </form>
  );
}
