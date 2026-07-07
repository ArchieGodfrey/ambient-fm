import { infer, isModelLoaded } from "../runtime/modelRuntime";

// Ask the in-browser LLM to write a short, evocative "vibe" for a sound, from
// the user's building blocks. Returns plain prose (the deterministic describeVibe
// in sounds/vibe.ts remains the instant, no-model fallback).
export async function generateVibeText(opts: { moodWords: string; key?: string; tempo?: number; instruction?: string }): Promise<string> {
  if (!isModelLoaded()) {
    throw new Error("Model not loaded");
  }
  const prompt = [
    "You are a poet. In one or two short, evocative sentences, describe the feeling of a piece of ambient music.",
    `Mood: ${opts.moodWords}`,
    `Key: ${opts.key ?? "open"}`,
    `Tempo: ${opts.tempo ?? "unhurried"} bpm`,
    opts.instruction ? `Direction: ${opts.instruction}` : "",
    "Write only the sentences — no quotes, no markdown, no preamble.",
  ].filter(Boolean).join("\n");

  const text = await infer(prompt);
  return text.trim().replace(/^["'\s]+|["'\s]+$/g, "").slice(0, 240);
}
