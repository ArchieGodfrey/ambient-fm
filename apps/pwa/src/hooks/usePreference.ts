import { useMemo } from "react";
import useSessionHistory from "./useSessionHistory";
import useFeedback from "./useFeedback";
import { computePreference, describePreference, type PreferenceVector } from "../preference/model";
import { buildYourSound, describeDrift } from "../preference/yourSound";
import type { Sound } from "../sounds/types";
import { useAppStore } from "../store/useAppStore";

// The preference vector (6b) + the emergent Your Sound (6c), recomputed from the
// current sessions + feedback + recent stimulus whenever they change.
export default function usePreference() {
  const { sessions } = useSessionHistory();
  const { feedback } = useFeedback();
  const events = useAppStore((s) => s.events);

  const preference: PreferenceVector = useMemo(() => computePreference(sessions, feedback), [sessions, feedback]);

  const yourSound: Sound = useMemo(() => buildYourSound(preference, events), [preference, events]);

  const drift = useMemo(() => {
    const recent = sessions.slice().sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
    if (recent.length < 3) return null;
    const rE = recent.reduce((a, s) => a + (s.avgEnergy ?? 0.5), 0) / recent.length;
    const rM = recent.reduce((a, s) => a + (/minor/i.test(s.key ?? "") ? 1 : 0), 0) / recent.length;
    return describeDrift(rE, preference.energy, rM, preference.minorBias);
  }, [sessions, preference]);

  return { preference, describe: describePreference(preference), yourSound, drift };
}
