import type { CompositionPlan, Phrase } from "../ai/types";

let startTime = 0;
let plan: CompositionPlan | null = null;
let currentPhraseId: string | null = null;

// `now` is the base timestamp (ms) the scheduler measures elapsed time against.
// Live playback uses performance.now(); an offline render passes 0 so the clock
// aligns with the offline transport's seconds (see renderTrack).
export function startScheduler(p: CompositionPlan, now = performance.now()) {
  plan = p;
  startTime = now;
  currentPhraseId = null;
}

export function tick(currentTimeFn: () => number, onPhraseChange: (phrase: Phrase) => void) {
  if (!plan) return;

  const t = (currentTimeFn() - startTime) / 1000;
  const section = plan.sections.find(
    (s) => t >= s.start && t < s.start + s.duration,
  );

  if (!section || !Array.isArray(section.phraseIds) || section.phraseIds.length === 0) {
    return;
  }

  const phraseId = section.phraseIds[0];
  if (phraseId === currentPhraseId) return;

  const phrase = plan.phrases.find((p) => p.id === phraseId);
  if (!phrase) return;

  currentPhraseId = phraseId;
  onPhraseChange(phrase);
}
