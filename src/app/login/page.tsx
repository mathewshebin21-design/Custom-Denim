import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Sign In" };

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const next = typeof searchParams.next === "string" ? searchParams.next : null;

  return (
    <div className="container-editorial py-24">
      <p className="label-eyebrow text-rust mb-4">Sign In</p>
      <h1 className="font-display text-4xl mb-10">Welcome back.</h1>
      <LoginForm next={next} />
    </div>
  );
}
