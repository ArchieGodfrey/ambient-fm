import { useCallback, useState } from "react";
import {
  kokoroEnabled, setKokoroEnabled, kokoroStatus, loadKokoro, clearKokoro, kokoroRender, kokoroPlay,
  type KokoroStatus,
} from "../audio/hostKokoro";
import { postToast } from "../utils/toast";

// Manages the optional Kokoro neural DJ voice for the Settings UI: download it
// (with progress), enable/disable, test, and remove from cache.
export default function useKokoroManager() {
  const [enabled, setEnabled] = useState(kokoroEnabled());
  const [status, setStatus] = useState<KokoroStatus>(kokoroStatus());
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");

  const download = useCallback(async () => {
    setStatus("loading");
    setProgress(0);
    const ok = await loadKokoro((p, t) => { setProgress(p); setProgressText(t); });
    setStatus(kokoroStatus());
    if (ok) {
      setKokoroEnabled(true);
      setEnabled(true);
      postToast("Voice host ready.", "success");
    } else {
      postToast("Couldn't load the voice host — using the built-in voice.", "error");
    }
    return ok;
  }, []);

  // Toggle use of the voice. Turning on triggers a download if not ready yet.
  const toggle = useCallback((v: boolean) => {
    setKokoroEnabled(v);
    setEnabled(v);
    if (v && kokoroStatus() !== "ready") void download();
  }, [download]);

  const remove = useCallback(async () => {
    await clearKokoro();
    setKokoroEnabled(false);
    setEnabled(false);
    setStatus("idle");
    setProgress(0);
    setProgressText("");
    postToast("Voice host removed.", "success");
  }, []);

  const test = useCallback(async () => {
    const clip = await kokoroRender("This is your station host. Good to have you tuned in.");
    if (clip) await kokoroPlay(clip);
    else postToast("Voice host isn't ready yet.", "error");
  }, []);

  return { enabled, status, progress, progressText, download, toggle, remove, test };
}
