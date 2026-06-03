import { useEffect, useRef, useState } from "react";
import { getVocalSynth } from "../audio/vocal/vocalSynth";
import { db } from "../db/db";
import { getSingingParams } from "../audio/vocal/musicTheory";
import { postToast } from "../utils/toast";
import type { VocalSynthStatus } from "../audio/vocal/vocalSynth";
import type { SessionSummary } from "../memory/types";
import type { CompositionPlan } from "../ai/types";

// ─── Vocal regeneration utility ───────────────────────────────────────────────

const VOICE_OPTIONS = [
  { id: 'browser',      label: 'Browser (instant)' },
  { id: 'piper_lessac', label: 'Lessac · Piper' },
  { id: 'piper_ryan',   label: 'Ryan · Piper' },
  { id: 'piper_amy',    label: 'Amy · Piper' },
  { id: 'af_sky',       label: 'Sky · Kokoro' },
  { id: 'af_bella',     label: 'Bella · Kokoro' },
  { id: 'af_sarah',     label: 'Sarah · Kokoro' },
  { id: 'am_adam',      label: 'Adam · Kokoro' },
  { id: 'am_echo',      label: 'Echo · Kokoro' },
  { id: 'bf_emma',      label: 'Emma · Kokoro' },
  { id: 'bm_george',    label: 'George · Kokoro' },
];

type ProgressFn = (done: number, total: number, currentLine?: string) => void;

async function regenerateVocals(plan: CompositionPlan, onProgress: ProgressFn, overrideVoice?: string) {
  const synth = getVocalSynth();
  const voice = overrideVoice ?? plan.vocalVoice;

  if (!voice || voice === 'ai') {
    postToast('Select a specific voice to synthesise', 'warning');
    return;
  }
  // browser voice → skip synthesis (already instant)
  if (voice === 'browser') {
    postToast('Browser Voice plays instantly — no synthesis needed', 'info');
    return;
  }

  const lines = plan.sections
    .map(s => s.lyricLine)
    .filter((l): l is string => Boolean(l));

  if (lines.length === 0) {
    postToast('No lyric lines in this composition', 'warning');
    return;
  }

  if (!synth.isReady) {
    onProgress(-1, lines.length);
    try {
      await synth.load();
    } catch (err) {
      postToast(`Kokoro load failed: ${err instanceof Error ? err.message.slice(0, 100) : String(err)}`, 'error');
      return;
    }
  }

  let done = 0;
  await Promise.allSettled(lines.map(async (line) => {
    const section = plan.sections.find(s => s.lyricLine === line);
    const singingParams = !voice.startsWith('piper_') && section ? getSingingParams(plan, section) : undefined;
    const t0 = Date.now();
    try {
      await synth.synthesize(line, voice, singingParams);
      done++;
      postToast(`Vocal ${done}/${lines.length} ready (${((Date.now() - t0) / 1000).toFixed(1)}s)`, 'info');
      onProgress(done, lines.length, line);
    } catch (err) {
      done++;
      postToast(`Vocal ${done}/${lines.length} failed: ${err instanceof Error ? err.message.slice(0, 80) : String(err)}`, 'error');
      onProgress(done, lines.length);
    }
  }));
}

// ─── Regeneration state ───────────────────────────────────────────────────────

type RegenState = {
  id: string;
  done: number;
  total: number;
  currentLine: string | null;
};

// ─── Component ────────────────────────────────────────────────────────────────

type Props = { sessions: SessionSummary[]; onDelete: (id: string) => Promise<void> | void };

export default function SessionHistory({ sessions, onDelete }: Props) {
  const [regenState, setRegenState] = useState<RegenState | null>(null);
  const [sessionVoices, setSessionVoices] = useState<Record<string, string>>({});
  const [elapsed, setElapsed] = useState(0);
  const [kokoroStatus, setKokoroStatus] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Elapsed seconds counter
  useEffect(() => {
    if (regenState) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [regenState?.id]);

  // Listen to Kokoro's internal status for extra detail
  useEffect(() => {
    const onStatus = (e: Event) => {
      const detail = (e as CustomEvent<VocalSynthStatus>).detail;
      if (detail?.text) setKokoroStatus(detail.text);
      if (detail?.stage === 'ready') setKokoroStatus(null);
    };
    window.addEventListener('vocal-synth-status', onStatus);
    return () => window.removeEventListener('vocal-synth-status', onStatus);
  }, []);

  const btn: React.CSSProperties = {
    border: "1px solid var(--border)", borderRadius: 8, background: "transparent",
    color: "var(--text)", padding: "6px 12px", fontSize: 12, cursor: "pointer",
  };

  const isActive = regenState !== null;
  const isLoading = regenState?.done === -1;

  return (
    <section style={{ marginTop: 24 }}>
      <h2>Session History</h2>
      {sessions.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No sessions yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {sessions.map(session => {
            const thisRegen = regenState?.id === session.id;
            const lyricSections = session.plan?.sections.filter(s => s.lyricLine) ?? [];

            return (
              <div key={session.id} style={{
                border: `1px solid ${thisRegen ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 12, padding: 14,
                background: "var(--surface-strong)", display: "grid", gap: 10,
                transition: "border-color 0.2s",
              }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {session.key ?? 'Unknown'} · {Math.round(session.avgBpm ?? 0)} BPM
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {new Date(session.timestamp).toLocaleString()}
                      {session.plan?.vocalVoice && (
                        <span style={{ marginLeft: 8 }}>· {session.plan.vocalVoice}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{session.dominantMood}</div>
                </div>

                {/* Lyric preview */}
                {lyricSections.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {lyricSections.slice(0, 3).map((s, i) => (
                      <div key={i} style={{
                        fontSize: 12, fontStyle: "italic",
                        color: thisRegen && regenState?.currentLine === s.lyricLine
                          ? "var(--accent)" : "var(--text-muted)",
                        transition: "color 0.2s",
                      }}>
                        "{s.lyricLine}"
                      </div>
                    ))}
                    {lyricSections.length > 3 && (
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        +{lyricSections.length - 3} more
                      </div>
                    )}
                  </div>
                )}

                {/* Regeneration progress panel */}
                {thisRegen && (
                  <div style={{ display: "grid", gap: 6, padding: "8px 0 2px" }}>
                    {/* Progress bar */}
                    {!isLoading && regenState && (
                      <div style={{ height: 3, borderRadius: 2, background: "var(--border)", overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 2, background: "var(--accent)",
                          width: `${Math.min(100, (regenState.done / regenState.total) * 100)}%`,
                          transition: "width 0.3s",
                        }} />
                      </div>
                    )}

                    {/* Status line */}
                    <div style={{ fontSize: 12, color: "var(--accent)", display: "flex", justifyContent: "space-between" }}>
                      <span>
                        {isLoading
                          ? 'Loading Kokoro model…'
                          : regenState && regenState.done < regenState.total
                            ? `Vocal ${regenState.done + 1}/${regenState.total}${regenState.currentLine ? `: "${regenState.currentLine.slice(0, 40)}${regenState.currentLine.length > 40 ? '…' : ''}"` : ''}`
                            : 'Vocals ready ✓'}
                      </span>
                      <span style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                        {elapsed}s
                      </span>
                    </div>

                    {/* Kokoro internal status (model download/init progress) */}
                    {kokoroStatus && (
                      <div style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.02em" }}>
                        {kokoroStatus}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
                  {/* Voice selector for re-synthesis */}
                  {session.plan && (
                    <select
                      value={sessionVoices[session.id] ?? session.plan?.vocalVoice ?? 'af_sky'}
                      disabled={isActive}
                      onChange={e => setSessionVoices(prev => ({ ...prev, [session.id]: e.target.value }))}
                      style={{
                        fontSize: 12, padding: "5px 8px", borderRadius: 8,
                        border: "1px solid var(--border)", background: "var(--surface-strong)",
                        color: "var(--text)", cursor: "pointer", opacity: isActive ? 0.4 : 1,
                      }}
                    >
                      {VOICE_OPTIONS.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                    </select>
                  )}
                  {session.plan && (
                    <button
                      type="button"
                      disabled={isActive}
                      onClick={async () => {
                        if (!session.plan) return;
                        const total = session.plan.sections.filter(s => s.lyricLine).length;
                        const selectedVoice = sessionVoices[session.id] ?? session.plan.vocalVoice ?? 'af_sky';
                        setRegenState({ id: session.id, done: 0, total, currentLine: null });
                        setKokoroStatus(null);
                        try {
                          // Save the chosen voice back to the session so it persists
                          if (session.plan && selectedVoice !== session.plan.vocalVoice) {
                            session.plan.vocalVoice = selectedVoice;
                            await db.sessions.put({ ...session }).catch(() => {});
                          }
                          await regenerateVocals(session.plan, (done, t, line) => {
                            setRegenState({ id: session.id, done, total: t, currentLine: line ?? null });
                          }, selectedVoice);
                        } finally {
                          setTimeout(() => setRegenState(null), 2500);
                        }
                      }}
                      style={{
                        ...btn,
                        color: thisRegen ? "var(--accent)" : "var(--text)",
                        borderColor: thisRegen ? "var(--accent)" : "var(--border)",
                        opacity: isActive && !thisRegen ? 0.4 : 1,
                      }}
                    >
                      {thisRegen
                        ? isLoading ? 'Loading…'
                          : regenState && regenState.done < regenState.total ? `Vocal ${regenState.done + 1}/${regenState.total}…`
                          : 'Ready ✓'
                        : '♪ Vocals'}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isActive}
                    onClick={() => { if (window.confirm("Delete this session?")) onDelete(session.id); }}
                    style={{ ...btn, color: "var(--text-muted)", opacity: isActive ? 0.4 : 1 }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
