import { useEffect, useState } from 'react';
import type { VocalSynthStage, VocalSynthStatus } from '../audio/vocal/vocalSynth';
import { getVocalSynth } from '../audio/vocal/vocalSynth';
import { db } from '../db/db';
import { postToast } from '../utils/toast';

export default function useVocalManager() {
  const [stage, setStage] = useState<VocalSynthStage>('idle');
  const [progress, setProgress] = useState<number | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onStatus = (e: Event) => {
      const detail = (e as CustomEvent<VocalSynthStatus>).detail;
      setStage(detail.stage);
      if (detail.progress != null) setProgress(detail.progress);
      else if (detail.stage === 'ready' || detail.stage === 'idle') setProgress(null);
      if (detail.text) setStatusText(detail.text);
      if (detail.error) setError(detail.error);
      else if (detail.stage === 'ready') setError(null);
    };
    window.addEventListener('vocal-synth-status', onStatus);
    // sync with current singleton state on mount
    const s = getVocalSynth().stage;
    setStage(s);
    return () => window.removeEventListener('vocal-synth-status', onStatus);
  }, []);

  async function loadAction() {
    setError(null);
    try {
      await getVocalSynth().load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function unloadAction() {
    getVocalSynth().destroy();
    setStage('idle');
    setProgress(null);
    setStatusText(null);
    setError(null);
  }

  async function deleteModelCacheAction() {
    try {
      // transformers.js stores ONNX model files in the browser Cache API
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(
          keys.filter(k => k.includes('transform') || k.includes('onnx') || k.includes('hf-hub') || k.includes('kokoro'))
              .map(k => caches.delete(k))
        );
      }
      postToast('Kokoro model cache cleared', 'success');
    } catch (err) {
      postToast(`Failed to clear cache: ${String(err)}`, 'error');
    }
  }

  async function warmupAction() {
    // Use the currently selected voice so we pre-compile/cache for the right voice
    const { useAppStore } = await import('../store/useAppStore');
    const voice = useAppStore.getState().composerSettings.vocalVoice;
    if (!voice || voice === 'browser' || voice === 'ai') {
      postToast('Select a specific Kokoro voice first to pre-synthesise it', 'info');
      return;
    }
    const text = 'salt light before the tide';
    // Clear this specific cache entry so we always re-run (shows real progress)
    try { await db.vocalAudio.delete(`${voice}:${text}`); } catch {}
    getVocalSynth().clearMemoryCache();
    try {
      await getVocalSynth().synthesize(text, voice);
    } catch {
      // error already surfaced via synth-error toast
    }
  }

  async function clearAudioCacheAction() {
    try {
      await db.vocalAudio.clear();
      getVocalSynth().clearMemoryCache();
    } catch {}
  }

  function cancelAction() {
    // Terminate the worker immediately — any GPU shaders compiled so far
    // are cached by the browser, so the next attempt will be faster
    getVocalSynth().destroy();
    setStage('idle');
    setProgress(null);
    setStatusText(null);
    setError(null);
  }

  return { stage, progress, statusText, error, loadAction, unloadAction, warmupAction, clearAudioCacheAction, cancelAction, deleteModelCacheAction };
}
