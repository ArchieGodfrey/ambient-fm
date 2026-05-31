import type { CompositionPlan, CompositionSection } from "../ai/types";
import { applySectionToAudio } from "./mapSectionToAudio";
import { evolveMotifs, initMotifs, updateMotifs } from "./motifManager";

export type CompositionRuntimeSnapshot = {
  cursor: number;
  activeSection: CompositionSection | null;
  intensity: number;
  drift: number;
  planDuration: number;
};

let plan: CompositionPlan | null = null;
let startTime = 0;
let rafId: number | null = null;
let snapshot: CompositionRuntimeSnapshot = {
  cursor: 0,
  activeSection: null,
  intensity: 0,
  drift: 0,
  planDuration: 0,
};
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
  snapshot = {
    cursor,
    activeSection,
    intensity,
    drift,
    planDuration: getPlanDuration(),
  };
  notifySubscribers();
}

let lastMotifEvolution = 0;

function tick() {
  if (!plan) {
    rafId = requestAnimationFrame(tick);
    return;
  }

  const cursor = getCursor();
  const activeSection = getActiveSection(cursor);
  const drift = getDrift();

  updateMotifs(plan.layers);
  if (performance.now() - lastMotifEvolution > 1500) {
    evolveMotifs(plan.motifs);
    lastMotifEvolution = performance.now();
  }

  applySectionToAudio(activeSection, plan.layers, plan, drift);
  updateSnapshot(cursor, activeSection, drift);

  rafId = requestAnimationFrame(tick);
}

export function startCompositionRuntime(planInput: CompositionPlan) {
  plan = planInput;
  initMotifs(plan.motifs);
  startTime = performance.now();
  lastMotifEvolution = performance.now();
  const cursor = getCursor();
  const activeSection = getActiveSection(cursor);
  const drift = getDrift();

  updateMotifs(plan.layers);
  applySectionToAudio(activeSection, plan.layers, plan, drift);
  updateSnapshot(cursor, activeSection, drift);
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
