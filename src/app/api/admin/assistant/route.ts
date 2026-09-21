import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, handleApiError } from "@/lib/auth/guards";
import { checkRateLimit } from "@/lib/rateLimit";
import { runAssistantTurn } from "@/lib/ai/adminAssistant";
import { appendAssistantResult, appendUserMessage, listAssistantMessages, toModelHistory } from "@/lib/ai/assistantHistory";

const ChatSchema = z.object({ message: z.string().min(1).max(4000) });

const LIMIT = 30;
const WINDOW_MS = 15 * 60 * 1000;

function serializeMessage(row: Awaited<ReturnType<typeof listAssistantMessages>>[number]) {
  return {
    id: row.id,
    role: row.role,
    kind: row.kind,
    text: row.text,
    summary: row.summary,
    action: row.actionJson ? JSON.parse(row.actionJson) : null,
    status: row.status,
    errorText: row.errorText,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Hydrates the assistant widget with this admin's persisted conversation. */
export async function GET() {
  try {
    const session = await requireAdmin();
    const rows = await listAssistantMessages(session.id);
    return NextResponse.json({ messages: rows.map(serializeMessage) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();

    // Keyed by admin user id, not IP — this is an authenticated, paid-API-call
    // endpoint, so the limit exists to bound cost/abuse per account rather
    // than to blunt anonymous brute-forcing (that's what the IP-keyed limits
    // on login/register/bootstrap are for).
    const rate = await checkRateLimit("admin-assistant", session.id, LIMIT, WINDOW_MS);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many assistant requests. Please wait a bit." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = ChatSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    // Persisted before calling the model so it's never lost even if the
    // model call itself fails — the point of persisting at all is that a
    // reload or a new session picks the conversation back up.
    await appendUserMessage(session.id, parsed.data.message);
    const history = toModelHistory(await listAssistantMessages(session.id));

    const result = await runAssistantTurn(history);
    const saved = await appendAssistantResult(session.id, result);

    return NextResponse.json({ ...result, id: saved.id, createdAt: saved.createdAt.toISOString() });
  } catch (err) {
    return handleApiError(err);
  }
}
