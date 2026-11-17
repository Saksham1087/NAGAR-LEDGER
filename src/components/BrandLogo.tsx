interface BrandLogoProps {
  size?: number;
  showSubtag?: boolean;
}

export function BrandLogo({ size = 30, showSubtag = false }: BrandLogoProps) {
  return (
    <span className="brand-lockup">
      <svg
        className="brand-logo-mark"
        viewBox="0 0 64 64"
        width={size}
        height={size}
        fill="none"
        aria-hidden="true"
      >
        <rect
          x="2"
          y="2"
          width="60"
          height="60"
          rx="4"
          fill="#141618"
          stroke="var(--border-strong)"
          strokeWidth="2.5"
        />
        <rect
          x="7"
          y="7"
          width="50"
          height="50"
          rx="2"
          stroke="#FAF8F4"
          strokeWidth="1.5"
          strokeOpacity="0.22"
        />
        <path
          d="M16 44V20L29 44V20"
          stroke="#FAF8F4"
          strokeWidth="4.2"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
        <path
          d="M48 20H37V32H48V44H36"
          stroke="#C8321A"
          strokeWidth="4.2"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      </svg>
      <span className="brand-lockup__text">
        <span className="brand-wordmark__name">NagrikSeva</span>
        {showSubtag && (
          <span className="brand-wordmark__sub">CIVIC SLA LEDGER</span>
        )}
      </span>
    </span>
  );
}
