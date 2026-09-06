import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = { title: "Create Account" };

export default async function RegisterPage(props: PageProps<"/register">) {
  const searchParams = await props.searchParams;
  const next = typeof searchParams.next === "string" ? searchParams.next : "/create";

  return (
    <div className="container-editorial py-24">
      <p className="label-eyebrow text-rust mb-4">Create Account</p>
      <h1 className="font-display text-4xl mb-10">Start your commission.</h1>
      <RegisterForm next={next} />
    </div>
  );
}
