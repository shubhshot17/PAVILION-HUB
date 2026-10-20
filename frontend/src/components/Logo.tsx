/* ============================================================
   PAVILION HUB — Brand logo (pure CSS/SVG, no image files)
   A stumps + ball mark inside a rounded square, plus wordmark.
   ============================================================ */

interface LogoProps {
  size?: number;
  showWordmark?: boolean;
}

export function Logo({ size = 36, showWordmark = true }: LogoProps) {
  return (
    <span className="logo">
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
        <rect
          x="2"
          y="2"
          width="44"
          height="44"
          rx="12"
          fill="var(--green-800)"
        />
        <rect
          x="2.75"
          y="2.75"
          width="42.5"
          height="42.5"
          rx="11.25"
          fill="none"
          stroke="var(--lime)"
          strokeOpacity="0.35"
          strokeWidth="1.5"
        />
        {/* stumps */}
        <rect
          x="17"
          y="13"
          width="2.6"
          height="17"
          rx="1.3"
          fill="var(--white)"
        />
        <rect
          x="22.7"
          y="10"
          width="2.6"
          height="20"
          rx="1.3"
          fill="var(--white)"
        />
        <rect
          x="28.4"
          y="13"
          width="2.6"
          height="17"
          rx="1.3"
          fill="var(--white)"
        />
        {/* bails */}
        <rect x="18.4" y="8.6" width="3" height="2" rx="1" fill="var(--lime)" />
        <rect x="26.6" y="8.6" width="3" height="2" rx="1" fill="var(--lime)" />
        {/* ball */}
        <circle cx="35.5" cy="33.5" r="5.5" fill="var(--lime)" />
        <path
          d="M32.6 30.4c1.8 1.6 3.2 4.4 2.9 6.6M38.4 30.4c-1.8 1.6-3.2 4.4-2.9 6.6"
          stroke="var(--green-800)"
          strokeWidth="1.2"
          fill="none"
        />
      </svg>
      {showWordmark && (
        <span className="logo__wordmark">
          PAVILION<strong>HUB</strong>
        </span>
      )}
    </span>
  );
}
