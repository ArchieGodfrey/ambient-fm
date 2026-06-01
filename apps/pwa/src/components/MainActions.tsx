type MainActionsProps = {
  isGenerating: boolean;
  onGenerate: () => Promise<void> | void;
};

export default function MainActions({ isGenerating, onGenerate }: MainActionsProps) {
  return (
    <div style={{ display: "grid", gap: 12, marginBottom: 16, maxWidth: 720, margin: "0 auto 16px" }}>
      <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating}
          style={{
            fontSize: 16,
            padding: "10px 18px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--surface-strong)",
            color: "var(--text)",
            cursor: isGenerating ? "not-allowed" : "pointer",
            opacity: isGenerating ? 0.75 : 1,
          }}
        >
          {isGenerating ? "Generating..." : "Generate composition"}
        </button>
      </div>
    </div>
  );
}
