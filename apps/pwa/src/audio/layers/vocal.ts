import * as Tone from 'tone';

export class VocalLayer {
  private reverb = new Tone.Reverb({ decay: 3.5, wet: 0.55 });
  private volume = new Tone.Volume(-2);
  private currentPlayer: Tone.Player | null = null;
  private _enabled = true;

  constructor() {
    this.reverb.connect(this.volume);
    this.volume.toDestination();
  }

  playRaw(raw: { audio: Float32Array; sampleRate: number }) {
    if (!this._enabled) return;
    this.stop();

    try {
      const audioCtx = Tone.getContext().rawContext as AudioContext;
      const audioBuffer = audioCtx.createBuffer(1, raw.audio.length, raw.sampleRate);
      audioBuffer.getChannelData(0).set(raw.audio);
      const toneBuffer = new Tone.ToneAudioBuffer(audioBuffer);
      const player = new Tone.Player(toneBuffer).connect(this.reverb);
      player.start();
      this.currentPlayer = player;
    } catch (err) {
      console.warn('[VocalLayer] playRaw error:', err);
    }
  }

  stop() {
    if (this.currentPlayer) {
      try { this.currentPlayer.stop(); } catch { /* ignore */ }
      try { this.currentPlayer.dispose(); } catch { /* ignore */ }
      this.currentPlayer = null;
    }
  }

  set enabled(val: boolean) {
    this._enabled = val;
    if (!val) this.stop();
  }

  get enabled() {
    return this._enabled;
  }

  dispose() {
    this.stop();
    this.reverb.dispose();
    this.volume.dispose();
  }
}

let instance: VocalLayer | null = null;

export function getVocalLayer(): VocalLayer {
  if (!instance) instance = new VocalLayer();
  return instance;
}
