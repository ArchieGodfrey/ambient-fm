import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX, ChevronDown } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { useRuntimeSnapshot } from "../hooks/useRuntimeSnapshot";
import { seekRuntime, subscribeRuntimeState } from "../audio/compositionRuntime";
import { getVocalSynth } from "../audio/vocal/vocalSynth";
import useVocalManager from "../hooks/useVocalManager";

type Props = { onClose: () => void };

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

export default function NowPlayingOverlay({ onClose }: Props) {
  const plan = useAppStore(s => s.currentPlan);
  const isPlaying = useAppStore(s => s.isPlaying);
  const playToggle = useAppStore(s => s.playToggle);
  const vocalsEnabled = useAppStore(s => s.vocalsEnabled);
  const setVocalsEnabled = useAppStore(s => s.setVocalsEnabled);
  const generativeMode = useAppStore(s => s.generativeMode);
  const setGenerativeMode = useAppStore(s => s.setGenerativeMode);
  const vocalVoice = plan?.vocalVoice;
  const { stage: vocalStage } = useVocalManager();
  const snapshot = useRuntimeSnapshot();
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const scrubbingRef = useRef(false);

  // Direct DOM update for scrub bar — bypasses React batching for 60fps smoothness
  useEffect(() => {
    return subscribeRuntimeState((snap) => {
      if (scrubbingRef.current) return;
      const dur = snap.planDuration;
      if (!dur) return;
      const pct = Math.min(100, (snap.cursor / dur) * 100);
      if (progressFillRef.current) progressFillRef.current.style.width = `${pct}%`;
      if (thumbRef.current) thumbRef.current.style.left = `${pct}%`;
    });
  }, []);

  const duration = plan?.duration ?? 0;
  const cursor = scrubbing ? scrubValue : snapshot.cursor;
  const progress = duration > 0 ? Math.min(1, cursor / duration) : 0;
  // lyricLine now set above via cursor-based section lookup
  const activeSection = snapshot.activeSection;

  const seek = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el || !duration) return;
    const rect = el.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const target = t * duration;
    setScrubValue(target);
    seekRuntime(target);
  }, [duration]);

  const onTrackPointerDown = useCallback((e: React.PointerEvent) => {
    setScrubbing(true);
    scrubbingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    seek(e.clientX);
  }, [seek]);

  const onTrackPointerMove = useCallback((e: React.PointerEvent) => {
    if (!scrubbing) return;
    seek(e.clientX);
  }, [scrubbing, seek]);

  const onTrackPointerUp = useCallback(() => {
    setScrubbing(false);
    scrubbingRef.current = false;
  }, []);

  // Next lyric line (from next section)
  // Use cursor-based lookup — avoids object reference comparison issues
  const snapshotCursor = snapshot.cursor;
  const currentSectionIdx = plan?.sections.findIndex(
    s => snapshotCursor >= s.start && snapshotCursor < s.start + s.duration
  ) ?? -1;
  const activeSec = currentSectionIdx >= 0 ? plan?.sections[currentSectionIdx] : null;
  const nextLyric = plan?.sections[currentSectionIdx + 1]?.lyricLine ?? null;
  const prevLyric = plan?.sections[currentSectionIdx - 1]?.lyricLine ?? null;
  const lyricLine = activeSec?.lyricLine ?? snapshot.currentLyricLine;

  return (
    <div
      style={{
        height: "100%",
        background: "linear-gradient(to bottom, #0a0d12 0%, #0c0f16 100%)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
      role="dialog" aria-modal="true"
    >
      {/* Drag handle / close */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close player"
        style={{
          display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 6,
          padding: "20px 0 12px", background: "none", border: "none", cursor: "pointer", width: "100%",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <div style={{ width: 48, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.25)" }} />
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>close</span>
      </button>

      {/* Key + meta */}
      <div style={{ padding: "4px 24px 0", textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {plan ? `${plan.key} · ${plan.bpm} BPM` : "No composition"}
        </div>
        {activeSection && (
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 3, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {activeSection.mood}
          </div>
        )}
      </div>

      {/* Lyrics area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "0 32px", gap: 10, minHeight: 0 }}>
        {prevLyric && (
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.2)", fontStyle: "italic", textAlign: "center" }}>
            {prevLyric}
          </p>
        )}
        <p
          key={lyricLine ?? "none"}
          style={{
            margin: 0,
            fontSize: lyricLine ? 22 : 15,
            fontStyle: "italic",
            fontWeight: 400,
            color: lyricLine ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.2)",
            lineHeight: 1.5,
            textAlign: "center",
            transition: "opacity 0.4s",
          }}
        >
          {lyricLine || (activeSec ? activeSec.mood : plan ? "…" : "No composition loaded")}
        </p>
        {nextLyric && (
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.2)", fontStyle: "italic", textAlign: "center" }}>
            {nextLyric}
          </p>
        )}
        {vocalsEnabled && getVocalSynth().stage === "synthesizing" && (
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: "0.08em" }}>
            preparing vocals…
          </span>
        )}
      </div>

      {/* Section dots */}
      {plan && plan.sections.length > 0 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: "0 24px 16px" }}>
          {plan.sections.map((section, i) => {
            const isActive = section === activeSection;
            return (
              <div
                key={i}
                onClick={() => seekRuntime(section.start)}
                title={section.lyricLine ?? section.mood}
                style={{
                  width: isActive ? 20 : 6, height: 6, borderRadius: 3,
                  background: isActive ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.2)",
                  cursor: "pointer", transition: "all 0.3s",
                  flexShrink: 0,
                }}
              />
            );
          })}
        </div>
      )}

      {/* Scrub bar */}
      <div style={{ padding: "0 24px" }}>
        <div
          ref={trackRef}
          onPointerDown={onTrackPointerDown}
          onPointerMove={onTrackPointerMove}
          onPointerUp={onTrackPointerUp}
          style={{
            height: 36, display: "flex", alignItems: "center", cursor: "pointer", userSelect: "none",
          }}
        >
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", position: "relative" }}>
            <div ref={progressFillRef} style={{
              position: "absolute", left: 0, top: 0, height: "100%", borderRadius: 2,
              width: `${progress * 100}%`,
              background: "rgba(255,255,255,0.65)",
            }} />
            {/* Thumb */}
            <div ref={thumbRef} style={{
              position: "absolute", top: "50%", transform: "translate(-50%, -50%)",
              left: `${progress * 100}%`,
              width: 14, height: 14, borderRadius: "50%",
              background: "#fff",
              boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
            }} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: -4 }}>
          <span>{formatTime(cursor)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 32, padding: "16px 24px 24px" }}>
        {/* Vocals status + toggle */}
        <button
          type="button"
          onClick={() => setVocalsEnabled(!vocalsEnabled)}
          aria-label={vocalsEnabled ? "Mute vocals" : "Enable vocals"}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            background: "none", border: "none", cursor: "pointer", padding: 8,
          }}
        >
          {(() => {
            const isSynth = vocalStage === 'synthesizing' || vocalStage === 'loading';
            const isReady = vocalStage === 'ready';
            const isBrowser = !vocalVoice || vocalVoice === 'browser';
            return (
              <>
                {vocalsEnabled
                  ? <Volume2 size={20} color={isSynth ? "rgba(167,139,250,0.8)" : isReady ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.35)"} />
                  : <VolumeX size={20} color="rgba(255,255,255,0.2)" />}
                <span style={{
                  fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase" as const,
                  color: isSynth ? "rgba(167,139,250,0.7)"
                    : isReady && !isBrowser ? "rgba(74,222,128,0.7)"
                    : "rgba(255,255,255,0.25)",
                  whiteSpace: "nowrap" as const,
                }}>
                  {!vocalsEnabled ? "off"
                    : isBrowser ? "browser"
                    : isSynth ? "synth…"
                    : isReady ? "kokoro"
                    : "loading"}
                </span>
              </>
            );
          })()}
        </button>

        {/* Play/Pause */}
        <button
          type="button"
          onClick={() => playToggle?.()}
          disabled={!playToggle}
          aria-label={isPlaying ? "Pause" : "Play"}
          style={{
            width: 60, height: 60, borderRadius: "50%",
            border: "none",
            background: "rgba(255,255,255,0.9)",
            color: "#0a0d12",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: playToggle ? "pointer" : "not-allowed",
            boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
          }}
        >
          {isPlaying ? <Pause size={26} fill="#0a0d12" /> : <Play size={26} fill="#0a0d12" style={{ marginLeft: 3 }} />}
        </button>

        {/* Skip to next section */}
        <button
          type="button"
          onClick={() => {
            if (!plan || !activeSection) return;
            const next = plan.sections.find(s => s.start > (activeSection.start + 0.5));
            if (next) seekRuntime(next.start);
          }}
          aria-label="Next section"
          style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)", padding: 8 }}
        >
          <ChevronDown size={20} style={{ transform: "rotate(-90deg)" }} />
        </button>

        {/* Generative mode toggle */}
        <button
          type="button"
          onClick={() => setGenerativeMode(!generativeMode)}
          aria-label={generativeMode ? "Disable generative" : "Enable generative"}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            background: "none", border: "none", cursor: "pointer", padding: 8,
          }}
        >
          <span style={{ fontSize: 16, color: generativeMode ? "rgba(167,139,250,0.8)" : "rgba(255,255,255,0.25)" }}>&#8734;</span>
          <span style={{ fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase" as const,
            color: generativeMode ? "rgba(167,139,250,0.7)" : "rgba(255,255,255,0.2)" }}>
            {generativeMode ? "endless" : "loop"}
          </span>
        </button>
      </div>
    </div>
  );
}
