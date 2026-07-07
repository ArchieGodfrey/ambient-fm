import * as Tone from "tone";
import type { CompositionPlan, CompositionSection, Phrase } from "../ai/types";
import { applySectionToAudio } from "./mapSectionToAudio";
import { activatePhrase, updatePhraseIntensity, stopPhrase } from "./phraseRuntime";
import { field, getTick } from "../music/random/randomField";
import { startScheduler, tick as schedulerTick } from "./sectionScheduler";
import { saveSnapshot, type RuntimeSnapshot } from "../memory/runtimeSnapshots";
import { composerState } from "../composer/composerState";
import { setMelody, stopMelody } from "./melodyTrack";

export type CompositionRuntimeSnapshot = {
  cursor: number;
  activeSection: CompositionSection | null;
  activePhrase: Phrase | null;
  intensity: number;
  drift: number;
  planDuration: number;
  sectionTimeRemaining: number;
  activeMotifs: number;
  runtimeUptime: number;
  frameDelay: number;
  audioRestartCount: number;
  snapshotCount: number;
};

let plan: CompositionPlan | null = null;
let startTime = 0;
let rafId: number | null = null;
let currentPhrase: Phrase | null = null;
let snapshot: CompositionRuntimeSnapshot = {
  cursor: 0,
  activeSection: null,
  activePhrase: null,
  intensity: 0,
  drift: 0,
  planDuration: 0,
  sectionTimeRemaining: 0,
  activeMotifs: 0,
  runtimeUptime: 0,
  frameDelay: 0,
  audioRestartCount: 0,
  snapshotCount: 0,
};
let lastFrameTime = performance.now();
let audioRestartCount = 0;
let snapshotCount = 0;
let checkpointIntervalId: number | null = null;
const subscribers = new Set<(snapshot: CompositionRuntimeSnapshot) => void>();

function getPlanDuration() {
  if (!plan) return 0;
  const duration = typeof plan.duration === "number" && Number.isFinite(plan.duration) && plan.duration > 0 ? plan.duration : 30;
  return duration;
}

function getCursor() {
  if (!plan) return 0;
  const elapsed = (performance.now() - startTime) / 1000;
  const duration = getPlanDuration();
  return duration > 0 ? elapsed % duration : elapsed;
}

function getActiveSection(cursor: number) {
  if (!plan || !Array.isArray(plan.sections)) return null;
  return plan.sections.find((section) => cursor >= section.start && cursor < section.start + section.duration) ?? null;
}

function getSectionTimeRemaining(cursor: number, section: CompositionSection | null) {
  if (!section) return 0;
  return Math.max(0, section.start + section.duration - cursor);
}

function getDrift(plan: CompositionPlan, tick: number) {
  const rng = field(plan.seed, tick, "drift");
  return (rng() - 0.5) * 0.2;
}

function deriveComposerState(plan: CompositionPlan, tick: number) {
  const profile = plan.evolutionProfile;
  const density = Math.min(1, Math.max(0, composerState.currentDensity ?? 0.4));
  const densityRng = field(plan.seed, tick, "density");
  const evolvedDensity = Math.min(
    1,
    Math.max(0, density + (densityRng() - 0.5) * (profile?.densityDrift ?? 0.05)),
  );
  const chordDuration = composerState.currentChordDuration ?? 16;
  const baseBpm = composerState.intent?.bpm ?? plan.bpm;
  const tempoFactor = 16 / chordDuration;
  const adjustedBpm = Math.min(240, Math.max(20, baseBpm * tempoFactor));

  const instrumentBoost = composerState.activeInstruments.reduce(
    (acc, id) => {
      if (id === "pad") acc.pad += 0.05;
      if (id === "bell") acc.texture += 0.05;
      if (id === "bass") acc.pulse += 0.05;
      return acc;
    },
    { pad: 0, texture: 0, pulse: 0 } as { pad: number; texture: number; pulse: number },
  );

  return {
    bpm: adjustedBpm,
    layers: {
      drone: plan.layers.drone,
      pad: Math.min(1, Math.max(0, plan.layers.pad * (0.8 + evolvedDensity * 0.4) + instrumentBoost.pad)),
      texture: Math.min(1, Math.max(0, plan.layers.texture * (0.7 + evolvedDensity * 0.5) + instrumentBoost.texture)),
      pulse: Math.min(1, Math.max(0, plan.layers.pulse * (0.6 + evolvedDensity * 0.5) + instrumentBoost.pulse)),
    },
    texture: {
      density: Math.min(1, Math.max(0, plan.texture.density * (0.9 + evolvedDensity * 0.1))),
      brightness: Math.min(1, Math.max(0, plan.texture.brightness * (0.9 + density * 0.1))),
      reverbAmount: plan.texture.reverbAmount,
    },
  };
}

function notifySubscribers() {
  subscribers.forEach((callback) => {
    callback(snapshot);
  });
}

function updateSnapshot(cursor: number, activeSection: CompositionSection | null, drift: number) {
  const intensity = activeSection?.intensity ?? 0.5;
  const sectionTimeRemaining = getSectionTimeRemaining(cursor, activeSection);
  const runtimeUptime = plan ? (performance.now() - startTime) / 1000 : 0;
  const now = performance.now();
  const frameDelay = Math.max(0, now - lastFrameTime - 16);
  lastFrameTime = now;

  snapshot = {
    cursor,
    activeSection,
    activePhrase: currentPhrase,
    intensity,
    drift,
    planDuration: getPlanDuration(),
    sectionTimeRemaining,
    activeMotifs: currentPhrase?.motifs.length ?? 0,
    runtimeUptime,
    frameDelay,
    audioRestartCount,
    snapshotCount,
  };
  notifySubscribers();
}

const MAX_RUNTIME_MS = 1000 * 60 * 30;

async function ensureAudioRunning() {
  const contextState = (Tone.context as unknown as { state?: unknown }).state;
  if (contextState !== "running") {
    try {
      await Tone.start();
      audioRestartCount += 1;
    } catch {
      // ignore startup failures; runtime will continue trying
    }
  }
}

function buildRuntimeSnapshot(cursor: number, activeSection: CompositionSection | null): RuntimeSnapshot | null {
  if (!plan) return null;
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    plan,
    cursorTime: cursor,
    activeSectionId: activeSection ? `${activeSection.start}-${activeSection.duration}` : "",
    activePhraseIds: currentPhrase ? [currentPhrase.id] : activeSection?.phraseIds ?? [],
    layerStates: {
      drone: plan.layers.drone,
      pad: plan.layers.pad,
      texture: plan.layers.texture,
      pulse: plan.layers.pulse,
    },
  };
}

function scheduleCheckpointing() {
  if (checkpointIntervalId !== null) return;
  checkpointIntervalId = window.setInterval(async () => {
    if (!plan) return;

    const cursor = getCursor();
    const activeSection = getActiveSection(cursor);
    const snapshotData = buildRuntimeSnapshot(cursor, activeSection);
    if (!snapshotData) return;

    const count = await saveSnapshot(snapshotData);
    snapshotCount = count;
  }, 5000);
}

function stopCheckpointing() {
  if (checkpointIntervalId !== null) {
    clearInterval(checkpointIntervalId);
    checkpointIntervalId = null;
  }
}

function tick() {
  if (!plan) {
    rafId = requestAnimationFrame(tick);
    return;
  }

  if (performance.now() - startTime > MAX_RUNTIME_MS) {
    stopRuntimeLoop();
    return;
  }

  const elapsed = (performance.now() - startTime) / 1000;
  if (elapsed > plan.duration * 3) {
    const cursor = getCursor();
    const activeSection = getActiveSection(cursor);
    if (activeSection) {
      startTime = performance.now() - activeSection.start * 1000;
    }
  }

  const cursor = getCursor();
  const activeSection = getActiveSection(cursor);
  const beatTick = getTick(cursor, plan.bpm);
  const drift = getDrift(plan, beatTick);

  void ensureAudioRunning();

  schedulerTick(() => performance.now(), (phrase) => {
    currentPhrase = phrase;
    const planValue = plan;
    if (!planValue) return;
    const phraseRng = field(planValue.seed, beatTick, `phrase_${phrase.id}`);
    activatePhrase(
      phrase,
      planValue.motifs ?? [],
      activeSection?.intensity ?? 0.5,
      composerState.currentDensity,
      phraseRng,
    );
  });

  if (currentPhrase) {
    updatePhraseIntensity(activeSection?.intensity ?? 0.5);
  }

  const derived = deriveComposerState(plan, beatTick);
  Tone.Transport.bpm.value = derived.bpm;
  applySectionToAudio(activeSection, derived.layers, { ...plan, texture: derived.texture }, drift);
  updateSnapshot(cursor, activeSection, drift);

  rafId = requestAnimationFrame(tick);
}

export function startCompositionRuntime(planInput: CompositionPlan, startOffset = 0) {
  plan = planInput;
  startScheduler(planInput);
  setMelody(planInput.melodyNotes, planInput.melodyInstrument); // recorded melody track (if any)
  startTime = performance.now() - startOffset * 1000;

  const cursor = getCursor();
  const activeSection = getActiveSection(cursor);
  const beatTick = getTick(cursor, plan.bpm);
  const drift = getDrift(plan, beatTick);

  schedulerTick(() => performance.now(), (phrase) => {
    currentPhrase = phrase;
    const planValue = plan;
    if (!planValue) return;
    const phraseRng = field(planValue.seed, beatTick, `phrase_${phrase.id}`);
    activatePhrase(
      phrase,
      planValue.motifs ?? [],
      activeSection?.intensity ?? 0.5,
      composerState.currentDensity,
      phraseRng,
    );
  });

  if (currentPhrase) {
    updatePhraseIntensity(activeSection?.intensity ?? 0.5);
  }

  const derived = deriveComposerState(plan, beatTick);
  Tone.Transport.bpm.value = derived.bpm;
  applySectionToAudio(activeSection, derived.layers, { ...plan, texture: derived.texture }, drift);
  updateSnapshot(cursor, activeSection, drift);
  scheduleCheckpointing();
}

export function startRuntimeLoop() {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(tick);
}

export function stopRuntimeLoop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  stopPhrase();
  stopMelody();
  stopCheckpointing();
}

export function getRuntimeSnapshot() {
  return snapshot;
}

export function subscribeRuntimeState(callback: (snapshot: CompositionRuntimeSnapshot) => void) {
  subscribers.add(callback);
  callback(snapshot);
  return () => {
    subscribers.delete(callback);
  };
}
