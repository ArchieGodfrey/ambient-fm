import { useCallback, useEffect, useState } from "react";

// "Your station" identity — the station name, the host (name + personality +
// voice). Persisted in localStorage; a change event keeps every hook instance in
// sync (same pattern as useSounds). Used by the DJ line generation, the voice
// (hostPiper), the wizard "Make it yours" step, and Settings → Station & host.

const STORAGE_KEY = "ambientfm-station";
const CHANGED = "station-changed";

// A curated shortlist of Piper English voices. The display name doubles as the
// default host name when a voice is picked. `en_US-hfc_female-medium` is the
// existing default (already downloaded for current users → no surprise re-fetch).
export type StationVoice = {
  id: string;        // Piper VoiceId
  name: string;      // display + default host name
  accent: "US" | "UK";
  gender: "female" | "male";
};

export const STATION_VOICES: StationVoice[] = [
  { id: "en_US-hfc_female-medium", name: "Ava", accent: "US", gender: "female" },
  { id: "en_US-amy-medium", name: "Amy", accent: "US", gender: "female" },
  { id: "en_US-kristin-medium", name: "Kristin", accent: "US", gender: "female" },
  { id: "en_US-ryan-medium", name: "Ryan", accent: "US", gender: "male" },
  { id: "en_US-joe-medium", name: "Joe", accent: "US", gender: "male" },
  { id: "en_GB-cori-medium", name: "Cori", accent: "UK", gender: "female" },
  { id: "en_GB-jenny_dioco-medium", name: "Jenny", accent: "UK", gender: "female" },
  { id: "en_GB-alan-medium", name: "Alan", accent: "UK", gender: "male" },
];

export const DEFAULT_VOICE_ID = STATION_VOICES[0].id;

export type StationConfig = {
  stationName: string;
  hostName: string;
  hostPersonality: string;
  voiceId: string;
};

export const DEFAULT_STATION: StationConfig = {
  stationName: "Ambient FM",
  hostName: STATION_VOICES[0].name, // "Ava"
  hostPersonality: "",
  voiceId: DEFAULT_VOICE_ID,
};

export function voiceName(voiceId: string): string {
  return STATION_VOICES.find((v) => v.id === voiceId)?.name ?? "your host";
}

export function getStation(): StationConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_STATION, ...JSON.parse(raw) };
  } catch { /* fall through to default */ }
  return { ...DEFAULT_STATION };
}

export function setStation(patch: Partial<StationConfig>): StationConfig {
  const next = { ...getStation(), ...patch };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CHANGED));
  return next;
}

// Reactive access to the station config.
export function useStation() {
  const [station, setStationState] = useState<StationConfig>(() => getStation());

  useEffect(() => {
    const onChange = () => setStationState(getStation());
    window.addEventListener(CHANGED, onChange);
    return () => window.removeEventListener(CHANGED, onChange);
  }, []);

  const update = useCallback((patch: Partial<StationConfig>) => setStation(patch), []);
  return { station, update };
}
