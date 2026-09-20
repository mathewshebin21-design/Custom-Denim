import { NextResponse } from "next/server";
import { listActiveProducts } from "@/lib/retail/service";

/** Public catalog listing. No auth — anyone can browse the Shop. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category") ?? undefined;
  const source = url.searchParams.get("source") ?? undefined;
  const products = await listActiveProducts({ category, source });
  return NextResponse.json({ products });
}
