export interface RecordingFeatures {
  energy: number;    // 0..1 from RMS
  brightness: number; // 0..1 from zero-crossing rate
  rms: number;
  zcr: number;
}

export interface Recording {
  id: string;
  ts: number;
  blob: Blob;
  durationMs: number;
  features: RecordingFeatures;
  label: string;
}
