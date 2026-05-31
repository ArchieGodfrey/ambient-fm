import * as Tone from "tone";
import type { CompositionPlan, CompositionSection, Phrase } from "../ai/types";
import { applySectionToAudio } from "./mapSectionToAudio";
import { evolveMotifs } from "./motifManager";
import { activatePhrase, updatePhraseIntensity, stopPhrase } from "./phraseRuntime";
import { startScheduler, tick as schedulerTick } from "./sectionScheduler";
import { saveSnapshot, type RuntimeSnapshot } from "../memory/runtimeSnapshots";

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

function getDrift() {
  return Math.sin(performance.now() / 10000) * 0.1;
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

let lastMotifEvolution = 0;

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
  const drift = getDrift();

  if (plan.layers) {
    plan.layers.pad = Math.min(1, Math.max(0, plan.layers.pad * (0.99 + Math.random() * 0.02)));
  }

  void ensureAudioRunning();

  schedulerTick(() => performance.now(), (phrase) => {
    currentPhrase = phrase;
    activatePhrase(phrase, plan?.motifs ?? [], activeSection?.intensity ?? 0.5);
  });

  if (currentPhrase) {
    updatePhraseIntensity(activeSection?.intensity ?? 0.5);
  }

  if (performance.now() - lastMotifEvolution > 1500) {
    evolveMotifs(plan.motifs);
    lastMotifEvolution = performance.now();
  }

  applySectionToAudio(activeSection, plan.layers, plan, drift);
  updateSnapshot(cursor, activeSection, drift);

  rafId = requestAnimationFrame(tick);
}

export function startCompositionRuntime(planInput: CompositionPlan, startOffset = 0) {
  plan = planInput;
  startScheduler(planInput);
  startTime = performance.now() - startOffset * 1000;
  lastMotifEvolution = performance.now();

  const cursor = getCursor();
  const activeSection = getActiveSection(cursor);
  const drift = getDrift();

  schedulerTick(() => performance.now(), (phrase) => {
    currentPhrase = phrase;
    activatePhrase(phrase, plan?.motifs ?? [], activeSection?.intensity ?? 0.5);
  });

  if (currentPhrase) {
    updatePhraseIntensity(activeSection?.intensity ?? 0.5);
  }

  applySectionToAudio(activeSection, plan.layers, plan, drift);
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
