import { useEffect } from "react";
import { X } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { useRuntimeSnapshot } from "../hooks/useRuntimeSnapshot";
import "./NowPlayingOverlay.css";

type Props = {
  onClose: () => void;
};

export default function NowPlayingOverlay({ onClose }: Props) {
  const plan = useAppStore((state) => state.currentPlan);
  const snapshot = useRuntimeSnapshot();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const activeSectionStart = snapshot.activeSection?.start ?? -1;
  const activeLayers = snapshot.activeSection?.layers ?? plan?.layers ?? null;
  const lyricLine = snapshot.currentLyricLine;

  return (
    <div className="npo-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="npo-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="npo-close" onClick={onClose} aria-label="Close now playing">
          <X size={17} />
        </button>

        {/* Header */}
        <div className="npo-header">
          <div className="npo-key">{plan?.key ?? "No composition"}</div>
          <div className="npo-meta">
            {plan ? `${plan.bpm} BPM · ${plan.globalMood}` : "No session loaded"}
          </div>
        </div>

        {/* Lyric */}
        <div className="npo-lyric-area">
          {lyricLine ? (
            <p key={lyricLine} className="npo-lyric">{lyricLine}</p>
          ) : (
            <p className="npo-lyric-placeholder">
              {plan ? "no lyric for this section" : "no composition loaded"}
            </p>
          )}
        </div>

        {/* Section timeline */}
        {plan && plan.sections.length > 0 && (
          <div className="npo-timeline" aria-label="Section timeline">
            {plan.sections.map((section, i) => {
              const isActive = section.start === activeSectionStart;
              const widthPct = plan.duration > 0
                ? (section.duration / plan.duration) * 100
                : 100 / plan.sections.length;
              return (
                <div
                  key={i}
                  className={`npo-section${isActive ? " npo-section--active" : ""}`}
                  style={{ width: `${widthPct}%` }}
                  title={`${section.mood} · ${section.start}–${section.start + section.duration}s`}
                >
                  <span className="npo-section-mood">{section.mood}</span>
                  {section.lyricLine && (
                    <span className="npo-section-lyric">{section.lyricLine}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Layer intensity bars */}
        {activeLayers && (
          <div className="npo-layers">
            {(["drone", "pad", "texture", "pulse"] as const).map((key) => (
              <div key={key} className="npo-layer-row">
                <span className="npo-layer-name">{key}</span>
                <div className="npo-layer-track">
                  <div
                    className="npo-layer-fill"
                    style={{ width: `${Math.round((activeLayers[key] ?? 0) * 100)}%` }}
                  />
                </div>
                <span className="npo-layer-pct">{Math.round((activeLayers[key] ?? 0) * 100)}%</span>
              </div>
            ))}
          </div>
        )}

        {/* Progress */}
        {plan && plan.duration > 0 && (
          <div className="npo-progress" aria-label="Playback progress">
            <div
              className="npo-progress-fill"
              style={{ width: `${Math.min(100, (snapshot.cursor / plan.duration) * 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
