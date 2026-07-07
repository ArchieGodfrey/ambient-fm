import { useCallback, useState } from "react";
import {
  voiceEnabled, setVoiceEnabled, voiceStatus, voiceInstalled, voiceReady, loadVoice, clearVoice, voiceRender, voicePlay,
  type VoiceStatus,
} from "../audio/hostPiper";
import { postToast } from "../utils/toast";

// Manages the Piper DJ voice for Settings: download (with progress), test, remove.
export default function useVoiceManager() {
  const [enabled, setEnabled] = useState(voiceEnabled());
  const [status, setStatus] = useState<VoiceStatus>(voiceStatus());
  const [installed, setInstalled] = useState(voiceInstalled());
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");

  const download = useCallback(async () => {
    setStatus("loading");
    setProgress(0);
    const ok = await loadVoice((p, t) => { setProgress(p); setProgressText(t); });
    setStatus(voiceStatus());
    setInstalled(voiceInstalled());
    if (ok) { setVoiceEnabled(true); setEnabled(true); postToast("DJ voice ready.", "success"); }
    else postToast("Couldn't load the DJ voice — captions will show instead.", "error");
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
    postToast("DJ voice removed.", "success");
  }, []);

  const test = useCallback(async () => {
    setVoiceEnabled(true);
    setEnabled(true);
    if (!voiceReady()) {
      setStatus("loading");
      await loadVoice((p, t) => { setProgress(p); setProgressText(t); });
      setStatus(voiceStatus());
      setInstalled(voiceInstalled());
    }
    const buf = await voiceRender("This is your station host. Good to have you tuned in.");
    if (buf) await voicePlay(buf);
    else postToast("Voice isn't ready yet.", "error");
  }, []);

  return { enabled, status, installed, progress, progressText, download, remove, test };
}
