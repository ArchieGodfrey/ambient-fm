import type { CompositionContext } from "./compositionContext";
import { INSTRUMENT_DESCRIPTIONS as MELODY_INSTRUMENT_DESCRIPTIONS } from "../audio/instruments/instrumentFactory";

function describeStimulus(stimulus: { source: string; label: string; strength: number; metadata?: any }) {
  const subtype = typeof stimulus.metadata?.type === "string" ? stimulus.metadata.type : stimulus.label;
  return `${stimulus.source}:${subtype} (${stimulus.strength.toFixed(2)})`;
}

const INSTRUMENT_DESCRIPTIONS: Record<string, string> = {
  drone: "drone: Continuous low-frequency sine wave oscillator with lowpass filter. Provides grounding and sustained presence.",
  pad: "pad: Polyphonic harmonic synth (PolySynth). Plays chord notes with a 2-beat sustain. Best for warm harmonic texture and melody. Primary voice.",
  texture: "texture: FM synthesis with whole-note modulated timbres. Evolving harmonic shimmer and atmospheric movement.",
  pulse: "pulse: Monophonic square-wave synth with 8th-note articulation. Adds rhythmic accent and forward motion. Use sparingly.",
};

export function buildPrompt(context: CompositionContext) {
  const stimuliText = context.stimuli
    .map((stimulus) => `- ${describeStimulus(stimulus)}`)
    .join("\n");

  const { allowedInstruments, minSections, maxSections, complexity, motifDensity, harmonicMovement, keyMode, maxBpm, vocalVoice, melodyInstrument } =
    context.composerSettings;
  const bassType = context.composerSettings.bassType ?? "ai";

  const instrumentLines = allowedInstruments
    .map((id) => `- ${INSTRUMENT_DESCRIPTIONS[id] ?? id}`)
    .join("\n");

  const approxMinDuration = minSections * 20 + 10;
  const approxMaxDuration = maxSections * 25;

  const keyModeHint =
    keyMode === "any"
      ? "any key and mode"
      : keyMode === "major"
        ? "a major key (e.g. C major, G major, D major)"
        : "a minor key (e.g. D minor, A minor, E minor)";

  const melodyInstrumentStr = melodyInstrument ?? "ai";
  const melodyBassBlock = `\nMELODY & BASS:\nChoose instruments that suit the mood and key.\n${melodyInstrumentStr === "ai" ? `Available melody instruments: ${Object.entries(MELODY_INSTRUMENT_DESCRIPTIONS).map(([k, v]) => `${k}: ${v}`).join("; ")}. Choose ONE primary instrument AND optionally 1-2 additional instruments per section for layering. Output melodyInstrument (overall default) and per-section melodyInstruments array.` : `Melody instrument is locked to: ${melodyInstrumentStr}`}\n${bassType === "ai" ? "Bass types: sparse (long root notes, calm), walking (quarter-note chord tones, focused), pulse (eighth notes, energised), none (no bass). Output bassType." : `Bass type is locked to: ${bassType}. Still output bassType in JSON.`}\nPer section, specify melodyInstruments as an array (can be 1-3 instruments for layering). Peak sections should have richer layering.\n`;

  const voiceBlock =
    vocalVoice === 'ai'
      ? `\nVOCAL VOICE SELECTION:\nChoose a voice that fits the mood and energy of this composition. Output it as "vocalVoice" in the JSON.\nAvailable voices:\n- af_sky: soft breathy American female — calm, introspective, ambient\n- af_bella: warm American female — emotional, focused, intimate\n- af_sarah: clear American female — bright, energised, direct\n- am_adam: American male — grounded, tense, neutral\n- am_echo: deep American male — dark, mysterious, contemplative\n- bf_emma: British female — measured, atmospheric, poetic\n- bm_george: authoritative British male — epic, cinematic, spacious\n`
      : '';

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
These are the audio layers available for this composition. Each value is 0.0 (silent) to 1.0 (full intensity).
Only use the instruments listed below — set any others to 0.0.
${instrumentLines}

COMPOSITION STRUCTURE RULES:
- Compose exactly ${minSections} to ${maxSections} sections that tell an evolving story.
- The total duration of all sections combined should be approximately ${approxMinDuration} to ${approxMaxDuration} seconds.
- Each section must specify: duration (seconds), mood, intensity (0–1), and per-instrument layer intensities.
- Sections should evolve meaningfully: for example, open sparsely, build complexity in the middle, then resolve or peak at the end.
- Vary layer intensities between sections — avoid keeping all layers at the same value throughout.
- The first section should feel like an introduction (low pulse, moderate pad).
- The last section should feel conclusive (either a gentle fade or an emotional peak).
- Give the composition a clear emotional arc — build tension across middle sections, resolve at the end.
- Vary the layer intensities dramatically between sections to create dynamic contrast.
- Motifs should have at least 6 notes with stepwise movement, not just repeated chord tones.

LYRIC RULES:
- Each section must include a "lyricLine": a short poetic phrase of 4–8 words that evokes the mood and feeling of that section.
- The lyric should be imagistic and abstract — no literal descriptions of music or instruments.
- Match the emotional character of the section's mood and the piece's musical key.
- Rhyme is not required. Aim for texture, not narrative.
- Example: "salt light before the tide", "waiting at the edge of the room", "held breath, slow dissolve".
- Write lyrics that feel like they could be sung — prioritise open vowels, natural stress, and breath rhythm.
- Do NOT use generic filler phrases like "ambient music" or "calm vibes".

STIMULI:
${stimuliText || "- none"}

MEMORY:
- recentKeys: ${context.memory.recentKeys.length > 0 ? context.memory.recentKeys.join(", ") : "none"}
- dominantInstrument: ${context.memory.dominantInstrument ?? "none"}
- averageDensity: ${context.memory.averageDensity.toFixed(2)}
- recurringMotifs: ${context.memory.recurringMotifs.length > 0 ? context.memory.recurringMotifs.join(", ") : "none"}

COMPOSER SETTINGS:
- complexity: ${complexity}
- motifDensity: ${motifDensity}
- harmonicMovement: ${harmonicMovement}
- keyMode: ${keyModeHint}
- maxBpm: ${maxBpm} (do not exceed this BPM)

${voiceBlock}
${melodyBassBlock}
OUTPUT FORMAT:
{
  "key": { "tonic": "D", "mode": "minor" },
  "bpm": 72,
  "progression": [0, 5, 3, 6],
  "motifDensity": 0.6,
  "complexity": 0.4,
  "energy": 0.5,
  "vocalVoice": "af_sky",
  "melodyInstrument": "piano",
  "bassType": "sparse",
  "sections": [
    { "duration": 20, "mood": "ambient",   "intensity": 0.3, "lyricLine": "salt light before the tide",       "melodyInstruments": ["piano"],                           "layers": { "drone": 0.6, "pad": 0.5, "texture": 0.2, "pulse": 0.0 } },
    { "duration": 25, "mood": "focused",   "intensity": 0.5, "lyricLine": "something is moving beneath",      "melodyInstruments": ["piano", "strings"],                "layers": { "drone": 0.4, "pad": 0.7, "texture": 0.4, "pulse": 0.2 } },
    { "duration": 20, "mood": "tense",     "intensity": 0.7, "lyricLine": "the edge of a held breath",        "melodyInstruments": ["piano", "strings", "electric_piano"], "layers": { "drone": 0.3, "pad": 0.6, "texture": 0.7, "pulse": 0.5 } },
    { "duration": 15, "mood": "energised", "intensity": 0.8, "lyricLine": "open sky, nothing between us",     "melodyInstruments": ["strings"],                         "layers": { "drone": 0.2, "pad": 0.8, "texture": 0.6, "pulse": 0.7 } },
    { "duration": 10, "mood": "calm",      "intensity": 0.2, "lyricLine": "slow dissolve into the afternoon", "melodyInstruments": ["glass"],                           "layers": { "drone": 0.5, "pad": 0.4, "texture": 0.2, "pulse": 0.0 } }
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
