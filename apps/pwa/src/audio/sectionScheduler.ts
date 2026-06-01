import type { CompositionPlan, Phrase } from "../ai/types";

let startTime = 0;
let plan: CompositionPlan | null = null;
let currentPhraseId: string | null = null;

export function startScheduler(p: CompositionPlan) {
  plan = p;
  startTime = performance.now();
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
