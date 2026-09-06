"use client";

export function SignOutButton() {
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        // Full reload (not router.push) so server components — the header's
        // session check in particular — re-render with the cleared cookie.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/";
      }}
      className="label-eyebrow text-ink/70 hover:text-rust"
    >
      Sign Out
    </button>
  );
}
