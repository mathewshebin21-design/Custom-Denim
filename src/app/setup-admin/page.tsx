import type { Metadata } from "next";
import { AdminBootstrapForm } from "@/components/auth/AdminBootstrapForm";

export const metadata: Metadata = { title: "Admin Setup", robots: { index: false, follow: false } };

export default function SetupAdminPage() {
  return (
    <div className="container-editorial py-24">
      <p className="label-eyebrow text-rust mb-4">One-Time Setup</p>
      <h1 className="font-display text-3xl mb-10">Create the Admin Account</h1>
      <AdminBootstrapForm />
    </div>
  );
}
