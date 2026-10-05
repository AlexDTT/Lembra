import { useCopy } from '../i18n/ux';
export function Brand({ compact = false }: { compact?: boolean }) {
  const copy = useCopy();
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
          <path
            d="M8 23V9a2 2 0 0 1 4 0v12h10a2 2 0 0 1 0 4H10a2 2 0 0 1-2-2Z"
            fill="currentColor"
          />
          <path d="M19 8c2-4 6-4 7-4 0 5-2 8-7 8V8Z" fill="#bce6c7" />
        </svg>
      </span>
      <div>
        <strong>
          Lembra<span className="brand-dot">.</span>
        </strong>
        {!compact && <p>{copy.tagline}</p>}
      </div>
    </div>
  );
}
