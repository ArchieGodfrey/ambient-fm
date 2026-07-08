import { InstrumentRegistry } from "./registry";
import { createPadInstrument } from "./pad";
import { createPulseInstrument } from "./pulse";
import { createTextureInstrument } from "./texture";

const registry = new InstrumentRegistry();

function registerDefaultInstruments() {
  registry.register(createPadInstrument());
  registry.register(createPulseInstrument());
  registry.register(createTextureInstrument());
}

registerDefaultInstruments();

// Dispose the current instruments and rebuild them in whatever Tone context is
// active. The instrument synths are cached against the context they were created
// in, so an offline render must rebuild them in the offline context (and live
// must rebuild them in the live context afterwards).
export function resetInstruments() {
  registry.getAll().forEach((instrument) => {
    try { instrument.dispose?.(); } catch { /* node from a disposed context */ }
  });
  registry.clear();
  registerDefaultInstruments();
}

export { registry as instrumentRegistry };
