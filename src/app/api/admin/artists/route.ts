import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, handleApiError } from "@/lib/auth/guards";
import { listArtistsForAdmin, createArtist } from "@/lib/admin/service";

export async function GET() {
  try {
    await requireAdmin();
    const artists = await listArtistsForAdmin();
    return NextResponse.json({ artists });
  } catch (err) {
    return handleApiError(err);
  }
}

const CreateArtistSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  bio: z.string().optional(),
  photoUrl: z.string().min(1).optional(),
  styleTags: z.array(z.string()).default([]),
  capacityStatus: z.enum(["available", "limited", "full"]).default("available"),
});

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => null);
    const parsed = CreateArtistSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const artist = await createArtist(parsed.data);
    return NextResponse.json({ artist }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
