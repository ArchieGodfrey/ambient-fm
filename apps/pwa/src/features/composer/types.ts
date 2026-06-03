export type LayerId = 'drone' | 'pad' | 'texture' | 'pulse';

export type KeyMode = 'any' | 'major' | 'minor';

export interface ComposerSettings {
  complexity: number;
  motifDensity: number;
  harmonicMovement: number;
  allowedInstruments: LayerId[];
  minSections: number;
  maxSections: number;
  vocalVoice: string;
  keyMode: KeyMode;
  maxBpm: number;
  melodyInstrument: string;
  bassType: string;
}
