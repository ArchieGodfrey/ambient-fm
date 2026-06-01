import { InstrumentRegistry } from "./registry";
import { createPadInstrument } from "./pad";
import { createPulseInstrument } from "./pulse";
import { createTextureInstrument } from "./texture";

const registry = new InstrumentRegistry();
registry.register(createPadInstrument());
registry.register(createPulseInstrument());
registry.register(createTextureInstrument());

export { registry as instrumentRegistry };
