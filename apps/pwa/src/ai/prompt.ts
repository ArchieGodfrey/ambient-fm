import type { CompositionContext } from "./compositionContext";

function describeStimulus(stimulus: { source: string; label: string; strength: number; metadata?: any }) {
  const subtype = typeof stimulus.metadata?.type === "string" ? stimulus.metadata.type : stimulus.label;
  return `${stimulus.source}:${subtype} (${stimulus.strength.toFixed(2)})`;
}

export function buildPrompt(context: CompositionContext) {
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
- Keep the output minimal and avoid unnecessary extra detail.

AVAILABLE INSTRUMENTS:
These are the four audio layers you can assign per section. Each value is 0.0 (silent) to 1.0 (full intensity).
- drone: Continuous low-frequency sine wave oscillator with lowpass filter. Provides grounding and sustained presence. Works well as a quiet foundation throughout the piece.
- pad: Polyphonic harmonic synth (PolySynth). Plays chord notes with a 2-beat sustain. Best for warm harmonic texture and melody. Primary voice of the composition.
- texture: FM synthesis with whole-note modulated timbres. Evolving harmonic shimmer and atmospheric movement. Good for building density or adding otherworldly character.
- pulse: Monophonic square-wave synth with 8th-note articulation. Adds rhythmic accent and forward motion. Use sparingly — best during energised or focused sections.

COMPOSITION STRUCTURE RULES:
- Compose exactly 3 to 5 sections that tell an evolving story.
- The total duration of all sections combined should be approximately 90 seconds (1.5 minutes).
- Each section must specify: duration (seconds), mood, intensity (0–1), and per-instrument layer intensities.
- Sections should evolve meaningfully: for example, open sparsely with drone/pad, build texture and complexity in the middle, then resolve or peak at the end.
- Vary layer intensities between sections — avoid keeping all layers at the same value throughout.
- The first section should feel like an introduction (low pulse, moderate pad).
- The last section should feel conclusive (either a gentle fade or an emotional peak).

LYRIC RULES:
- Each section must include a "lyricLine": a short poetic phrase of 4–8 words that evokes the mood and feeling of that section.
- The lyric should be imagistic and abstract — no literal descriptions of music or instruments.
- Match the emotional character of the section's mood and the piece's musical key.
- Rhyme is not required. Aim for texture, not narrative.
- Example: "salt light before the tide", "waiting at the edge of the room", "held breath, slow dissolve".
- Do NOT use generic filler phrases like "ambient music" or "calm vibes".

STIMULI:
${stimuliText || "- none"}

MEMORY:
- recentKeys: ${context.memory.recentKeys.length > 0 ? context.memory.recentKeys.join(", ") : "none"}
- dominantInstrument: ${context.memory.dominantInstrument ?? "none"}
- averageDensity: ${context.memory.averageDensity.toFixed(2)}
- recurringMotifs: ${context.memory.recurringMotifs.length > 0 ? context.memory.recurringMotifs.join(", ") : "none"}

USER PREFERENCES:
- none

COMPOSER SETTINGS:
- complexity: ${context.composerSettings.complexity}
- motifDensity: ${context.composerSettings.motifDensity}
- harmonicMovement: ${context.composerSettings.harmonicMovement}

OUTPUT FORMAT:
{
  "key": { "tonic": "D", "mode": "minor" },
  "bpm": 72,
  "progression": [0, 5, 3, 6],
  "motifDensity": 0.6,
  "complexity": 0.4,
  "energy": 0.5,
  "sections": [
    { "duration": 20, "mood": "ambient",   "intensity": 0.3, "lyricLine": "salt light before the tide",       "layers": { "drone": 0.6, "pad": 0.5, "texture": 0.2, "pulse": 0.0 } },
    { "duration": 25, "mood": "focused",   "intensity": 0.5, "lyricLine": "something is moving beneath",      "layers": { "drone": 0.4, "pad": 0.7, "texture": 0.4, "pulse": 0.2 } },
    { "duration": 20, "mood": "tense",     "intensity": 0.7, "lyricLine": "the edge of a held breath",        "layers": { "drone": 0.3, "pad": 0.6, "texture": 0.7, "pulse": 0.5 } },
    { "duration": 15, "mood": "energised", "intensity": 0.8, "lyricLine": "open sky, nothing between us",     "layers": { "drone": 0.2, "pad": 0.8, "texture": 0.6, "pulse": 0.7 } },
    { "duration": 10, "mood": "calm",      "intensity": 0.2, "lyricLine": "slow dissolve into the afternoon",  "layers": { "drone": 0.5, "pad": 0.4, "texture": 0.2, "pulse": 0.0 } }
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
