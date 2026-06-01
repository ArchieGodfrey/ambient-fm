import { buildAIContext } from "../stimulus/aiContext";
import { computeEmotionalState } from "../stimulus/emotionalState";
import type { StimulusEvent } from "../types";

export function buildPrompt(emotionalState: ReturnType<typeof computeEmotionalState>, memoryContext: string, events: StimulusEvent[]) {
  const context = buildAIContext(emotionalState, memoryContext, events);

  return `
You are an ambient music composer.

Convert the following emotional state and stimulus summary into a structured music plan.

RULES:
- Output EXACTLY one valid JSON object
- Do NOT include explanations, markdown fences, backticks, or any extra text
- Do NOT wrap the JSON in quotes, code blocks, or markdown formatting
- Only output the JSON object, nothing else
- Use 3 to 5 sequential sections
- Ensure sections are non-overlapping and each has start/duration/intensity/mood
- Set duration to cover the end of the final section
- You should slightly vary today’s composition while respecting past mood trends.
- Avoid repeating identical keys or BPM patterns unless strongly justified by stimuli.
- Do NOT ask for a full composition. Only generate motif seeds, phrase structure, and the plan metadata.
- Also generate 2–4 musical motifs.
- Each motif must be short (2–5 notes), assigned to a layer (pad, pulse, or texture), and use a simple rhythmic structure.
- Also generate 2–3 phrases.
- Each phrase should group 1–3 motifs, have a role (build, release, static, transition), and variation between 0 and 1.
- Sections must reference one or more phrase IDs.
- Keep the output minimal and avoid unnecessary extra detail.

${memoryContext}

EMOTIONAL STATE:
${JSON.stringify(context.emotionalState, null, 2)}

STIMULUS SUMMARY:
${context.stimulusSummary
    .map((stimulus) => `- ${stimulus.label}: ${stimulus.strength.toFixed(2)}`)
    .join("\n")}

OUTPUT FORMAT:
{
  "key": "string",
  "bpm": number,
  "duration": number,
  "globalMood": "string",
  "sections": [
    {
      "start": number,
      "duration": number,
      "mood": "calm | focused | tense | ambient | energised",
      "intensity": number,
      "phraseIds": ["string"]
    }
  ],
  "texture": {
    "density": number,
    "brightness": number,
    "reverbAmount": number
  },
  "layers": {
    "drone": number,
    "pad": number,
    "texture": number,
    "pulse": number
  },
  "motifs": [
    {
      "id": "string",
      "layer": "pad | pulse | texture",
      "notes": ["C4", "E4"],
      "rhythm": [1, 0.5]
    }
  ],
  "phrases": [
    {
      "id": "string",
      "motifs": ["string"],
      "length": number,
      "variation": number,
      "role": "build | release | static | transition"
    }
  ]
}
`;
}

export function sanitizeJsonResponse(response: string) {
  let text = response.trim();

  text = text.replace(/[‘’]/g, '"').replace(/[“”]/g, '"');
  text = text.replace(/```(?:json)?/gi, "");
  text = text.replace(/`/g, "");
  text = text.replace(/^(?:.*?\{)/s, "{");

  const extracted = extractFirstJsonObject(text);
  return extracted ?? text;
}

export function extractFirstJsonObject(text: string): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;
  let startIndex = -1;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === "\\") {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        startIndex = i;
      }
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0 && startIndex !== -1) {
        return text.slice(startIndex, i + 1).trim();
      }
    }
  }

  return null;
}

export function escapeJsonStringLiterals(text: string) {
  let inString = false;
  let escape = false;
  let result = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (escape) {
      result += char;
      escape = false;
      continue;
    }

    if (char === "\\") {
      result += char;
      escape = true;
      continue;
    }

    if (char === '"') {
      result += char;
      inString = !inString;
      continue;
    }

    if (inString) {
      if (char === "\n") {
        result += "\\n";
        continue;
      }
      if (char === "\r") {
        result += "\\r";
        continue;
      }
      if (char === "\t") {
        result += "\\t";
        continue;
      }
    }

    result += char;
  }

  return result;
}

export function tryParseJsonWithRecovery(text: string) {
  try {
    return JSON.parse(text);
  } catch (error) {
    const escaped = escapeJsonStringLiterals(text);
    if (escaped !== text) {
      try {
        return JSON.parse(escaped);
      } catch {
        // continue to fallback
      }
    }

    const trimmed = extractFirstJsonObject(text) ?? text;
    if (trimmed !== text) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // continue to final throw
      }
    }

    throw error;
  }
}
