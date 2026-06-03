import type { VocalSynthStage } from '../audio/vocal/vocalSynth';

type Props = {
  stage: VocalSynthStage;
  progress: number | null;
  statusText?: string | null;
  error: string | null;
  onLoad: () => Promise<void>;
  onUnload: () => void;
  onClearCache: () => Promise<void>;
  onCancel: () => void;
};

const STAGE_COLOR: Record<VocalSynthStage, string> = {
  idle: 'var(--text-muted)',
  loading: 'var(--accent)',
  ready: '#4ade80',
  synthesizing: '#a78bfa',
  error: '#f87171',
};

function Dot({ stage }: { stage: VocalSynthStage }) {
  const glow = stage === 'synthesizing' || stage === 'loading';
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
      background: STAGE_COLOR[stage],
      boxShadow: glow ? `0 0 0 3px ${STAGE_COLOR[stage]}33` : 'none',
    }} />
  );
}

const btn = (extra?: React.CSSProperties): React.CSSProperties => ({
  fontSize: 13, padding: '8px 16px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--surface-strong)',
  color: 'var(--text)', cursor: 'pointer', ...extra,
});

export default function VocalModelActions({ stage, progress, statusText, error, onLoad, onUnload, onClearCache, onCancel }: Props) {
  const canLoad   = stage === 'idle' || stage === 'error';
  const canUnload = stage === 'ready' || stage === 'synthesizing';
  const isLoading = stage === 'loading';
  const isSynth   = stage === 'synthesizing';
  const isReady   = stage === 'ready';

  return (
    <div style={{ display: 'grid', gap: 12 }}>

      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Dot stage={stage} />
        <span style={{ fontSize: 13, fontWeight: 600, color: STAGE_COLOR[stage] }}>
          {stage === 'idle' ? 'Not loaded'
            : stage === 'loading' ? 'Loading model…'
            : stage === 'ready' ? 'Ready'
            : stage === 'synthesizing' ? 'Synthesising…'
            : 'Error'}
        </span>
        {(stage === 'idle' || stage === 'error') && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· Web Speech active</span>
        )}
      </div>

      {/* Progress bar */}
      {(isLoading || isSynth) && (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
            {isLoading && progress != null ? (
              <div style={{ width: `${Math.round(progress * 100)}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s' }} />
            ) : (
              <div style={{ width: '40%', height: '100%', background: STAGE_COLOR[stage], opacity: 0.8 }} />
            )}
          </div>
          {statusText && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{statusText}</div>}
          {isSynth && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Pre-synthesising warms up the inference pipeline and caches the audio — future plays are instant. Cancel stops the worker; compiled shaders stay in the browser's GPU cache so the next attempt continues faster.
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && <div style={{ fontSize: 13, color: '#f87171', lineHeight: 1.5 }}>{error.split('\n')[0]}</div>}

      {/* Descriptions */}
      {stage === 'idle' && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Load Kokoro for natural-sounding vocals (~20 MB, cached after first download).</div>}
      {isReady && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>High-quality Kokoro vocals active.</div>}

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {canLoad && (
          <button type="button" disabled={isLoading} onClick={() => void onLoad()} style={btn()}>
            {isLoading ? 'Loading…' : 'Load Kokoro'}
          </button>
        )}
        {isReady && (
          <button type="button" onClick={() => void onClearCache()} style={btn({ color: 'var(--text-muted)' })}>
            Clear audio cache
          </button>
        )}
        {isSynth && (
          <button type="button" onClick={onCancel} style={btn({ color: '#f87171', border: '1px solid #f87171' })}>
            Cancel
          </button>
        )}
        {canUnload && !isSynth && (
          <button type="button" onClick={onUnload} style={btn({ color: 'var(--text-muted)' })}>
            Unload
          </button>
        )}
      </div>
    </div>
  );
}
