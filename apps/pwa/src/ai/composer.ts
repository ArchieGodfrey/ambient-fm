import { CreateMLCEngine } from "@mlc-ai/web-llm";
import type { StimulusEvent } from "../types";
import type { CompositionPlan } from "./types";

let engine: any;

export async function initComposer() {
  if (engine) return engine;

  engine = await CreateMLCEngine("Phi-3-mini-4k-instruct-q4f16_1");
  return engine;
}

function buildPrompt(events: StimulusEvent[]) {
  return `
You are an ambient music composer.

Convert the following daily stimulus timeline into a structured music plan.

RULES:
- Output ONLY valid JSON
- Do not include explanations
- Keep structure consistent

STIMULUS EVENTS:
${events
    .map(
      (e) => `- ${e.source}: ${e.label} (${new Date(e.timestamp).toISOString()})`
    )
    .join("\n")}

OUTPUT FORMAT:
{
  "key": "string",
  "bpm": number,
  "globalMood": "string",
  "sections": [
    {
      "start": number,
      "duration": number,
      "mood": "calm | focused | tense | ambient | energised",
      "intensity": number
    }
  ],
  "texture": {
    "density": number,
    "brightness": number,
    "reverbAmount": number
  }
}
`;
}

function defaultComposition(): CompositionPlan {
  return {
    key: "C minor",
    bpm: 70,
    globalMood: "fallback",
    sections: [],
    texture: {
      density: 0.5,
      brightness: 0.5,
      reverbAmount: 0.5,
    },
  };
}

export async function generateComposition(events: StimulusEvent[]) {
  const model = await initComposer();
  const prompt = buildPrompt(events);

  try {
    const response = await model.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.choices?.[0]?.message?.content ?? "";
    return JSON.parse(text) as CompositionPlan;
  } catch (error) {
    console.error("AI composer failed", error);
    return defaultComposition();
  }
}
