import "server-only";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/auth/guards";
import type { AssistantTurnResult, ChatMessage } from "./adminAssistant";

const HISTORY_LIMIT = 50;

/**
 * The admin assistant's conversation, persisted per admin so it survives a
 * page reload or a brand-new session instead of resetting to empty every
 * time — real memory, not just React state living in one browser tab. Past
 * turns (including whether a proposal was ever confirmed) are fed back to
 * the model as context on every new turn; see toModelHistory().
 */
export async function listAssistantMessages(adminId: string) {
  const rows = await db.assistantMessage.findMany({
    where: { adminId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
  });
  return rows.reverse();
}

export async function appendUserMessage(adminId: string, text: string) {
  return db.assistantMessage.create({ data: { adminId, role: "user", kind: "text", text } });
}

export async function appendAssistantResult(adminId: string, result: AssistantTurnResult) {
  if (result.kind === "message") {
    return db.assistantMessage.create({ data: { adminId, role: "assistant", kind: "text", text: result.text } });
  }
  return db.assistantMessage.create({
    data: {
      adminId,
      role: "assistant",
      kind: "proposal",
      summary: result.summary,
      actionJson: JSON.stringify(result.action),
      status: "pending",
    },
  });
}

/** Ownership-checked: a messageId belonging to a different admin 404s rather than silently no-op-ing. */
export async function resolveProposal(
  adminId: string,
  messageId: string,
  status: "confirmed" | "cancelled" | "error",
  errorText?: string,
) {
  const message = await db.assistantMessage.findUnique({ where: { id: messageId } });
  if (!message || message.adminId !== adminId || message.kind !== "proposal") {
    throw new ApiError(404, "Assistant message not found");
  }
  return db.assistantMessage.update({ where: { id: messageId }, data: { status, errorText } });
}

type PersistedMessage = Awaited<ReturnType<typeof listAssistantMessages>>[number];

/**
 * Renders persisted rows as the plain {role, text} history
 * runAssistantTurn() expects — a proposal becomes a short factual summary
 * of what was proposed and what happened to it, so the model knows (for
 * example) that a restock it suggested earlier was actually applied, without
 * needing to replay the original tool-call machinery. Every line is
 * date-stamped (the system prompt in adminAssistant.ts tells the model to
 * read these), so "since last week" means something concrete instead of
 * being guessed from message order.
 */
export function toModelHistory(rows: PersistedMessage[]): ChatMessage[] {
  return rows.map((row) => {
    const date = row.createdAt.toLocaleDateString("en-CA", { timeZone: "UTC" });
    if (row.kind === "text") {
      return { role: row.role as "user" | "assistant", text: `[${date}] ${row.text ?? ""}` };
    }
    const resolution =
      row.status === "confirmed" ? "confirmed and applied" : row.status === "cancelled" ? "cancelled" : "not yet resolved";
    return { role: "assistant", text: `[${date}] Proposed action: ${row.summary} (${resolution})` };
  });
}
