export function hashStimuli(stimuli: unknown) {
  return JSON.stringify(stimuli);
}

export function shouldReactToStimuli(currentHash: string | null, nextHash: string) {
  return currentHash !== nextHash;
}

export function smallStimulusAdjustment(value: number) {
  return Math.max(0, Math.min(1, value + 0.05));
}
