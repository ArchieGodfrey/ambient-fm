import { registerInstrument } from "./registry";
import { createPadInstrument } from "./pad";
import { createBellInstrument } from "./bell";
import { createBassInstrument } from "./bass";

registerInstrument(createPadInstrument());
registerInstrument(createBellInstrument());
registerInstrument(createBassInstrument());
