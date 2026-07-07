// Single-playback mutex ("the floor"). Only one audio source plays at a time —
// the radio, a manual Listen/preview, or a voice preview. Claiming the floor
// stops whoever held it, so e.g. clicking Listen stops the radio, and tuning in
// stops a preview. Each owner passes its own stop fn.
let currentStop: (() => void) | null = null;

export function takeFloor(stop: () => void): void {
  if (currentStop && currentStop !== stop) {
    const prev = currentStop;
    currentStop = null; // clear first so prev's releaseFloor is a no-op
    prev();
  }
  currentStop = stop;
}

export function releaseFloor(stop: () => void): void {
  if (currentStop === stop) currentStop = null;
}
