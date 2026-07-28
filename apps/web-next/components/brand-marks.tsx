/* Third-party brand marks, used nominatively to show what we integrate with.
   Inline SVG rather than remote images so they cost no request and inherit
   crisp rendering at any size. Each mark keeps its own official colors: a
   brand logo recolored to match our theme stops reading as that brand. */

import * as React from 'react';

type MarkProps = { className?: string; style?: React.CSSProperties };

export function ShopifyMark({ className, style }: MarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={style}
      role="img"
      aria-label="Shopify"
      focusable="false"
    >
      <path
        fill="#95BF47"
        d="M15.34 4.32a.18.18 0 0 0-.16-.15c-.07 0-1.4-.03-1.4-.03s-1.11-1.08-1.22-1.19c-.11-.11-.33-.08-.41-.05l-.56.17C11.25 2.14 10.7 1.3 9.72 1.3h-.09c-.28-.36-.63-.52-.93-.52-2.33 0-3.44 2.91-3.79 4.39l-1.63.5c-.5.16-.52.17-.58.65-.05.36-1.37 10.6-1.37 10.6l10.28 1.93 5.57-1.35s-1.83-12.37-1.84-12.45zM11.06 3.27l-.9.28c0-.06 0-.13.01-.2 0-.66-.09-1.19-.24-1.61.6.08.99.75 1.13 1.53zM9.28 1.85c.17.42.28.99.28 1.76v.12l-1.86.58c.36-1.37 1.03-2.04 1.58-2.46zM8.57 1.18c.1 0 .2.03.29.1-.72.34-1.5 1.2-1.83 2.92l-1.47.45C5.96 3.28 6.9 1.18 8.57 1.18z"
      />
      <path
        fill="#5E8E3E"
        d="M15.18 4.17c-.07 0-1.4-.03-1.4-.03s-1.11-1.08-1.22-1.19a.27.27 0 0 0-.15-.07l-.78 15.94 5.57-1.35s-1.83-12.37-1.84-12.45a.18.18 0 0 0-.18-.85z"
      />
      {/* Nudged to sit on the bag's optical centre (the body spans x 1.3 to
          17.2, the glyph is 6 wide), otherwise the letter reads left-shifted. */}
      <path
        fill="#FFF"
        transform="translate(2.4 0)"
        d="M9.72 6.9l-.69 2.04s-.61-.32-1.35-.32c-1.09 0-1.14.68-1.14.85 0 .93 2.44 1.29 2.44 3.48 0 1.72-1.09 2.83-2.56 2.83-1.77 0-2.67-1.1-2.67-1.1l.47-1.56s.93.8 1.71.8c.51 0 .72-.4.72-.7 0-1.22-2-1.27-2-3.27 0-1.69 1.21-3.32 3.66-3.32.94 0 1.41.27 1.41.27z"
      />
    </svg>
  );
}

export function GeminiMark({ className, style }: MarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={style}
      role="img"
      aria-label="Google Gemini"
      focusable="false"
    >
      <defs>
        <linearGradient id="gc-gemini-gradient" x1="0" y1="24" x2="24" y2="0">
          <stop offset="0" stopColor="#4285F4" />
          <stop offset="0.52" stopColor="#9B72CB" />
          <stop offset="1" stopColor="#D96570" />
        </linearGradient>
      </defs>
      {/* The four-pointed spark: each side is a quarter arc pulled in to the
          centre, which is what gives the mark its concave star silhouette. */}
      <path
        fill="url(#gc-gemini-gradient)"
        d="M12 0c0 6.63 5.37 12 12 12-6.63 0-12 5.37-12 12 0-6.63-5.37-12-12-12C6.63 12 12 6.63 12 0z"
      />
    </svg>
  );
}
