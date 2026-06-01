import SessionHistory from "../components/SessionHistory";
import useSessionHistory from "../hooks/useSessionHistory";

export default function SessionsPage() {
  const { sessions } = useSessionHistory();

  return (
    <div style={{ padding: 20, fontFamily: "system-ui, sans-serif", color: "var(--text)", paddingBottom: 110 }}>
      <SessionHistory sessions={sessions} />
    </div>
  );
}
