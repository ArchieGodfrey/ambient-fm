import { db } from "../db/db";
import type { SessionSummary } from "./types";

export async function getMemoryContext() {
  const sessions = await db.sessions.orderBy("timestamp").toArray();
  const last = sessions.slice(-5);

  if (last.length === 0) {
    return "PAST SESSIONS CONTEXT: none";
  }

  return [
    "PAST SESSIONS CONTEXT:",
    ...last.map((session) =>
      `Mood:${session.dominantMood}, BPM:${Math.round(session.avgBpm)}, Key:${session.key}`,
    ),
  ].join("\n");
}

export async function getLastSessionSummaries(): Promise<SessionSummary[]> {
  return await db.sessions.orderBy("timestamp").reverse().limit(5).toArray();
}

export async function getSessionHistory(): Promise<SessionSummary[]> {
  return await db.sessions.orderBy("timestamp").reverse().toArray();
}
