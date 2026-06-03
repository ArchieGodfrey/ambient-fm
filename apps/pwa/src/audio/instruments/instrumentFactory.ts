import { loadPianoSampler } from './pianoSampler';
import { createMarimbaInstrument } from './marimba';
import { createStringsInstrument } from './strings';
import { createElectricPianoInstrument } from './electricPiano';
import { createGlassInstrument } from './glass';

export type InstrumentId = 'piano' | 'marimba' | 'strings' | 'electric_piano' | 'glass';

export const INSTRUMENT_DESCRIPTIONS: Record<InstrumentId, string> = {
  piano: 'rich, harmonic, intimate — good for all moods',
  marimba: 'bright, percussive, rhythmic — good for focused/energised',
  strings: 'smooth, sustained, atmospheric — good for calm/ambient',
  electric_piano: 'warm, jazzy — good for focused/ambient crossover',
  glass: 'crystalline, ethereal, sparse — good for calm/tense',
};

type SynthInstrument =
  | ReturnType<typeof createMarimbaInstrument>
  | ReturnType<typeof createStringsInstrument>
  | ReturnType<typeof createElectricPianoInstrument>
  | ReturnType<typeof createGlassInstrument>;

const synthCache = new Map<InstrumentId, SynthInstrument>();

export async function getInstrument(id: InstrumentId) {
  if (id === 'piano') {
    return loadPianoSampler();
  }
  if (!synthCache.has(id)) {
    let inst: SynthInstrument;
    switch (id) {
      case 'marimba': inst = createMarimbaInstrument(); break;
      case 'strings': inst = createStringsInstrument(); break;
      case 'electric_piano': inst = createElectricPianoInstrument(); break;
      case 'glass': inst = createGlassInstrument(); break;
      default: return undefined;
    }
    synthCache.set(id, inst);
  }
  return synthCache.get(id)!;
}

export function disposeAll() {
  for (const inst of synthCache.values()) inst.dispose();
  synthCache.clear();
}
