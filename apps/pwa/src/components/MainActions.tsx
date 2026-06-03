type MainActionsProps = {
  isGenerating: boolean;
  generateStage: string;
  onGenerate: () => Promise<void> | void;
};

export default function MainActions({ isGenerating, generateStage, onGenerate }: MainActionsProps) {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto 16px" }}>
      <button
        type="button"
        onClick={onGenerate}
        disabled={isGenerating}
        style={{
          width: "100%",
          fontSize: 16, padding: "12px 18px", borderRadius: 12,
          border: "1px solid var(--border)",
          background: isGenerating ? "var(--surface)" : "var(--surface-strong)",
          color: "var(--text)",
          cursor: isGenerating ? "not-allowed" : "pointer",
          opacity: isGenerating ? 0.9 : 1,
          textAlign: "center",
          transition: "all 0.2s",
        }}
      >
        {isGenerating ? (
          <span style={{ fontSize: 14 }}>
            <span style={{ opacity: 0.5 }}>Generating — </span>
            {generateStage}
          </span>
        ) : "Generate composition"}
      </button>
    </div>
  );
}
