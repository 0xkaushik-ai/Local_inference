/** The DeviceBench chip mark: a device outline whose rising bars measure readiness. */
export function LogoMark({ className = 'logo-mark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path className="logo-pins" d="M2.5 11h3M2.5 16h3M2.5 21h3M26.5 11h3M26.5 16h3M26.5 21h3" />
      <rect className="logo-chip" x="6" y="5" width="20" height="22" rx="4.5" />
      <rect className="logo-bar" x="10" y="17" width="3" height="5" rx="1" />
      <rect className="logo-bar" x="14.5" y="13" width="3" height="9" rx="1" />
      <rect className="logo-bar logo-bar-accent" x="19" y="9" width="3" height="13" rx="1" />
    </svg>
  );
}

export default function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <LogoMark />
      {!compact && (
        <span className="wordmark" translate="no">
          DeviceBench
        </span>
      )}
    </span>
  );
}
