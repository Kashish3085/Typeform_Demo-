// The product's own mark: a speech-bubble-shaped form card (a form that starts a conversation).
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size * 1.3} height={size} viewBox="0 0 26 20" fill="currentColor" aria-hidden>
      <rect x="0" y="0" width="26" height="16" rx="5" />
      <path d="M5 15l-2.4 5L11 15z" />
    </svg>
  );
}

export function Brand({ size = 24 }: { size?: number }) {
  return (
    <span className="brand">
      <LogoMark size={size} />
      <span className="brand-word">Typeform clone</span>
    </span>
  );
}
