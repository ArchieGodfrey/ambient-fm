import * as Tone from "tone";

export function scheduleMotif(callback: (time: number) => void) {
  Tone.Transport.scheduleRepeat((time) => {
    callback(time);
  }, "1m");
}

export function scheduleChord(callback: () => void) {
  Tone.Transport.scheduleRepeat(() => {
    callback();
  }, "16s");
}

export function scheduleSection(callback: () => void) {
  Tone.Transport.scheduleRepeat(() => {
    callback();
  }, "2m");
}
