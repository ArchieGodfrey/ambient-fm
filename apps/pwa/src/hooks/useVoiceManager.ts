import { useCallback, useState } from "react";
import {
  voiceEnabled, setVoiceEnabled, voiceStatus, voiceInstalled, voiceReady, loadVoice, clearVoice, voiceRender, voicePlay, stopVoice,
  type VoiceStatus,
} from "../audio/hostPiper";
import { takeFloor, releaseFloor } from "../audio/playbackFloor";

// Manages the Piper DJ voice for Settings: download (with progress), test, remove.
export default function useVoiceManager() {
  const [enabled, setEnabled] = useState(voiceEnabled());
  const [status, setStatus] = useState<VoiceStatus>(voiceStatus());
  const [installed, setInstalled] = useState(voiceInstalled());
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [previewing, setPreviewing] = useState(false);

  const download = useCallback(async () => {
    setStatus("loading");
    setProgress(0);
    const ok = await loadVoice((p, t) => { setProgress(p); setProgressText(t); });
    setStatus(voiceStatus());
    setInstalled(voiceInstalled());
    if (ok) { setVoiceEnabled(true); setEnabled(true); }
    else console.error("Couldn't load the DJ voice — captions will show instead.");
    return ok;
  }, []);

  const remove = useCallback(async () => {
    await clearVoice();
    setVoiceEnabled(false);
    setEnabled(false);
    setInstalled(false);
    setStatus("idle");
    setProgress(0);
    setProgressText("");
  }, []);

  const stopPreview = useCallback(() => {
    stopVoice();
    setPreviewing(false);
    releaseFloor(stopPreview);
  }, []);

  // Preview the DJ voice — toggles play/stop.
  const preview = useCallback(async () => {
    if (previewing) { stopPreview(); return; }
    setVoiceEnabled(true);
    setEnabled(true);
    if (!voiceReady()) {
      setStatus("loading");
      await loadVoice((p, t) => { setProgress(p); setProgressText(t); });
      setStatus(voiceStatus());
      setInstalled(voiceInstalled());
    }
    const buf = await voiceRender("This is your station host. Good to have you tuned in.");
    if (!buf) { console.error("Voice isn't ready yet."); return; }
    takeFloor(stopPreview); // stop the radio / other playback while previewing
    setPreviewing(true);
    await voicePlay(buf);   // resolves when it finishes (or is stopped)
    setPreviewing(false);
    releaseFloor(stopPreview);
  }, [previewing, stopPreview]);

  return { enabled, status, installed, previewing, progress, progressText, download, remove, preview };
}
