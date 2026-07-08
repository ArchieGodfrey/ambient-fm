import type { CompositionContext } from "./compositionContext";

function describeStimulus(stimulus: { source: string; label: string; strength: number; metadata?: any }) {
  const subtype = typeof stimulus.metadata?.type === "string" ? stimulus.metadata.type : stimulus.label;
  return `${stimulus.source}:${subtype} (${stimulus.strength.toFixed(2)})`;
}

export interface CompositionDirection {
  key?: { tonic: string; mode: string };
  progression?: number[];
  moodWords?: string;
  tempo?: number;
  hasMelody?: boolean;
  instruction?: string;
  vibe?: string;
}

function directionText(d?: CompositionDirection): string {
  if (!d) return "- none";
  const lines: string[] = [];
  if (d.vibe) lines.push(`- vibe: ${d.vibe}`);
  if (d.key) lines.push(`- key: ${d.key.tonic} ${d.key.mode}`);
  if (d.progression?.length) lines.push(`- chord degrees (0-indexed): ${d.progression.join(", ")}`);
  if (d.tempo) lines.push(`- tempo: ${d.tempo} bpm`);
  if (d.moodWords) lines.push(`- mood: ${d.moodWords}`);
  if (d.hasMelody) lines.push("- the user recorded a melody; compose to complement it");
  if (d.instruction) lines.push(`- how to fill the song: ${d.instruction}`);
  return lines.length ? lines.join("\n") : "- none";
}

export function buildPrompt(context: CompositionContext, direction?: CompositionDirection) {
  const stimuliText = context.stimuli
    .map((stimulus) => `- ${describeStimulus(stimulus)}`)
    .join("\n");

  return `
You are an ambient music composer.

You have a context object that describes what is happening now, what has happened before, and how the composer should behave.

RULES:
- Output EXACTLY one valid JSON object.
- Do NOT include explanations, markdown fences, backticks, or any extra text.
- Do NOT wrap the JSON in quotes, code blocks, or markdown formatting.
- Only output the JSON object, nothing else.
- Do NOT include raw notes, MIDI, or complete melodies in the output.
- The model should return a high-level composition intent that becomes a long-lived blueprint for the runtime.
- The composition blueprint should preserve mood, identity, key, harmony, motif density, and evolution intent.
- Use 3 to 5 chord degrees in the progression.
- Include a short, evocative "title" (2 to 4 words) that fits the mood — no quotes or punctuation.
- Keep the output minimal and avoid unnecessary extra detail.

STIMULI:
${stimuliText || "- none"}

MEMORY:
- recentKeys: ${context.memory.recentKeys.length > 0 ? context.memory.recentKeys.join(", ") : "none"}
- dominantInstrument: ${context.memory.dominantInstrument ?? "none"}
- averageDensity: ${context.memory.averageDensity.toFixed(2)}
- recurringMotifs: ${context.memory.recurringMotifs.length > 0 ? context.memory.recurringMotifs.join(", ") : "none"}

USER DIRECTION (honour this closely — match the key, tempo, and mood it specifies):
${directionText(direction)}

COMPOSER SETTINGS:
- complexity: ${context.composerSettings.complexity}
- motifDensity: ${context.composerSettings.motifDensity}
- harmonicMovement: ${context.composerSettings.harmonicMovement}

OUTPUT FORMAT:
{
  "key": {
    "tonic": "D",
    "mode": "minor"
  },
  "bpm": number,
  "progression": [0, 5, 3, 6],
  "motifDensity": 0.6,
  "complexity": 0.3,
  "energy": 0.4,
  "title": "Drifting Ember"
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
