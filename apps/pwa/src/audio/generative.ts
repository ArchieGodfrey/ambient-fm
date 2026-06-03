import { generateComposition } from '../ai/composer';
import { useAppStore } from '../store/useAppStore';
import { db } from '../db/db';
import { startCompositionRuntime } from './compositionRuntime';
import type { CompositionPlan } from '../ai/types';
import { postToast } from '../utils/toast';

async function generateNextSection(currentPlan: CompositionPlan): Promise<void> {
  const state = useAppStore.getState();
  const events = state.events ?? [];
  const settings = state.composerSettings;

  try {
    postToast('Generative: composing continuation…', 'info');

    // Generate a new composition based on current stimuli
    const { plan: newPlan } = await generateComposition(events, settings);

    // Merge: append new plan's sections after current plan ends
    const offset = currentPlan.duration;
    const appendedSections = newPlan.sections.map(s => ({
      ...s,
      start: s.start + offset,
    }));

    const mergedPlan: CompositionPlan = {
      ...currentPlan,
      duration: currentPlan.duration + newPlan.duration,
      sections: [...currentPlan.sections, ...appendedSections],
      motifs: [...currentPlan.motifs, ...newPlan.motifs.map(m => ({ ...m, id: `gen-${m.id}` }))],
      phrases: [...currentPlan.phrases, ...newPlan.phrases.map(p => ({ ...p, id: `gen-${p.id}` }))],
    };

    // Update the store with merged plan
    state.setCurrentPlan(mergedPlan);

    // Restart runtime with merged plan, continuing from the start of appended content
    startCompositionRuntime(mergedPlan, offset);

    // Save to session
    const sessionId = state.currentSessionId;
    if (sessionId) {
      const session = await db.sessions.get(sessionId);
      if (session) {
        session.plan = mergedPlan;
        await db.sessions.put(session);
      }
    }

    postToast('Generative: new sections added', 'success');
  } catch (err) {
    postToast(`Generative failed: ${err instanceof Error ? err.message.slice(0, 60) : String(err)}`, 'error');
  }
}

export function startGenerativeListener(): () => void {
  const handler = async (e: Event) => {
    const plan = (e as CustomEvent).detail.plan as CompositionPlan;
    await generateNextSection(plan);
    window.dispatchEvent(new CustomEvent('generative-done'));
  };
  window.addEventListener('generative-trigger', handler);
  return () => window.removeEventListener('generative-trigger', handler);
}
