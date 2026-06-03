import "./HomePage.css";
import { useEffect, useMemo, useState } from "react";
import { db } from "../db/db";
import { useAppStore } from "../store/useAppStore";
import MainActions from "../components/MainActions";
import CompositionPlanSummary from "../components/CompositionPlanSummary";
import useAudioComposer from "../hooks/useAudioComposer";
import useSessionHistory from "../hooks/useSessionHistory";
import { postToast } from "../utils/toast";
import { downloadModel, loadModel, isModelDownloaded, isModelLoaded } from "../runtime/modelRuntime";
import { buildStimulusSnapshot } from "../stimuli/buildStimulusSnapshot";

const SOURCE_COLOR: Record<string, string> = {
  time: "#60a5fa", weather: "#34d399", manual: "#a78bfa",
};

function StrengthBar({ value }: { value: number }) {
  return (
    <div style={{ flex: 1, height: 3, borderRadius: 2, background: "var(--border)", overflow: "hidden" }}>
      <div style={{
        width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`,
        height: "100%", background: "var(--text-h)", opacity: 0.65,
        transition: "width 0.4s ease",
      }} />
    </div>
  );
}

type Props = { onOpenMenu: () => void };

export default function HomePage({ onOpenMenu }: Props) {
  const events = useAppStore(s => s.events);
  const setEvents = useAppStore(s => s.setEvents);
  const addEvent = useAppStore(s => s.addEvent);
  const currentPlan = useAppStore(s => s.currentPlan);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateStage, setGenerateStage] = useState("");
  const { status: audioStatus, runtimeState, plan, runAIComposer, loadSessionPlan, loadStaticPlan, restoreSession } =
    useAudioComposer(events, isModelLoaded());
  const { sessions } = useSessionHistory();

  const inputGroups = useMemo(() => {
    const g: Record<string, { label: string; strength: number; count: number }> = {};
    for (const e of events) {
      const src = String(e.source);
      if (!g[src]) g[src] = { label: e.label, strength: 0, count: 0 };
      g[src].strength = Math.max(g[src].strength, e.strength);
      g[src].count += 1;
    }
    return Object.entries(g).map(([source, v]) => ({ source, ...v }));
  }, [events]);

  async function refreshStimuli() {
    try {
      const snap = await buildStimulusSnapshot();
      for (const ev of snap) { await db.events.add(ev); addEvent(ev); }
    } catch {}
  }

  useEffect(() => {
    async function init() {
      try {
        const loaded = await db.events.orderBy("timestamp").reverse().toArray();
        setEvents(loaded.map(e => ({
          ...e,
          strength: typeof e.strength === "number" ? e.strength
            : typeof (e as any).value === "number" ? Math.max(0, Math.min(1, (e as any).value)) : 0.5,
        })));
        if (!loaded.some(e => e.source === "time")) await refreshStimuli();
      } catch {}
      if (!currentPlan) {
        const restored = await restoreSession();
        if (!restored && sessions.length > 0 && sessions[0].plan) loadStaticPlan(sessions[0].plan);
      } else {
        loadStaticPlan(currentPlan);
      }
    }
    init();
  }, []);

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      if (!(await isModelDownloaded())) {
        setGenerateStage("downloading model…");
        await downloadModel();
      }
      if (!isModelLoaded()) {
        setGenerateStage("loading model…");
        await loadModel();
      }
      setGenerateStage("composing…");
      await runAIComposer();
      setGenerateStage("done");
      // runAIComposer sets status via setStatus for vocal stages
    } catch (err) {
      postToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setIsGenerating(false);
      setGenerateStage("");
    }
  }

  const intentSummary = plan?.intent
    ? `${plan.intent.key.tonic} ${plan.intent.key.mode} · ${Math.round(plan.intent.bpm)} BPM`
    : null;

  return (
    <div style={{ paddingBottom: 180, maxWidth: 720, margin: "0 auto" }}>

      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "20px 20px 8px",
      }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--text-h)" }}>Ambient FM</h1>
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Menu"
          style={{
            background: "none", border: "1px solid var(--border)", borderRadius: 8,
            width: 36, height: 36, cursor: "pointer", color: "var(--text-muted)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
            flexShrink: 0,
          }}
        >☰</button>
      </div>

      {/* Inputs */}
      <section style={{ padding: "12px 20px 20px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>
          Composition inputs
        </div>
        {inputGroups.length === 0 ? (
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>
            Visit Mood to shape your sound.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 9 }}>
            {inputGroups.map(({ source, strength, count }) => (
              <div key={source} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  display: "inline-block", width: 6, height: 6, borderRadius: "50%",
                  background: SOURCE_COLOR[source] ?? "var(--text-muted)", flexShrink: 0,
                }} />
                <span style={{ fontSize: 13, color: "var(--text)", minWidth: 80, textTransform: "capitalize" }}>
                  {source}{count > 1 ? ` ×${count}` : ""}
                </span>
                <StrengthBar value={strength} />
                <span style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 28, textAlign: "right" }}>
                  {Math.round(strength * 100)}%
                </span>
              </div>
            ))}
          </div>
        )}
        {intentSummary && (
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>
            Last: {intentSummary}
          </div>
        )}
      </section>

      {/* Generate */}
      <div style={{ padding: "0 20px 20px" }}>
        <MainActions isGenerating={isGenerating} generateStage={isGenerating ? (() => {
                const showAudio = audioStatus
                  && audioStatus !== "Ready"
                  && !audioStatus.startsWith("AI")
                  && !audioStatus.startsWith("Audio")
                  && !audioStatus.startsWith("Session")
                  && !audioStatus.startsWith("Loaded")
                  && !audioStatus.startsWith("Model not");
                return showAudio ? audioStatus : generateStage;
              })() : ""} onGenerate={handleGenerate} />
      </div>

      {/* Plan summary */}
      <div style={{ padding: "0 20px" }}>
        <CompositionPlanSummary
          plan={plan}
          runtimeCursor={runtimeState.cursor}
          activeSection={runtimeState.activeSection}
          currentPhraseRole={runtimeState.activePhrase?.role ?? null}
          sectionTimeRemaining={runtimeState.sectionTimeRemaining}
        />
      </div>

      {/* Recent sessions */}
      {sessions.length > 0 && (
        <section style={{ padding: "0 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>
            Recent sessions
          </div>
          <div style={{ display: "grid", gap: 7 }}>
            {sessions.slice(0, 5).map(s => (
              <div key={s.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                padding: "10px 14px", borderRadius: 10,
                background: "var(--surface)", border: "1px solid var(--border)",
              }}>
                <span style={{ fontSize: 13, color: "var(--text)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.key} · {Math.round(s.avgBpm)} BPM
                </span>
                <button type="button" disabled={!s.plan} onClick={() => s.plan && loadSessionPlan(s.plan, s.id)}
                  style={{
                    padding: "4px 12px", borderRadius: 7, fontSize: 12, flexShrink: 0,
                    border: "1px solid var(--border)",
                    background: s.plan ? "var(--surface-strong)" : "var(--surface)",
                    color: s.plan ? "var(--text)" : "var(--text-muted)",
                    cursor: s.plan ? "pointer" : "not-allowed",
                  }}>Load</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
