export default function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <path d="M7 5H3v18h4M21 5h4v18h-4" stroke="currentColor" strokeWidth="2" />
        <path d="M10 19v-5m4 5V9m4 10V5" stroke="var(--accent, #a43725)" strokeWidth="2.5" />
      </svg>
      {!compact && <span>devicebench</span>}
    </span>
  );
}
