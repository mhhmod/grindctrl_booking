/* Third-party brand marks, used nominatively to show what we work with.

   Inline SVG rather than remote images: no extra request, crisp at any size,
   and no dependency on a CDN staying up. Each mark keeps its own official
   colors, because a logo recolored to match our theme stops reading as that
   brand. Marks that are genuinely monochrome use currentColor so they invert
   correctly between light and dark.

   Scope note: every path here is a reconstruction from the mark's public
   geometry, not the vendor's official asset file. The set is deliberately
   limited to marks whose geometry is simple and unambiguous (triangles,
   grids, rounded bars, plates). Logos built from complex custom curves,
   OpenAI's knot and Meta's ribbon among them, are left out rather than
   shipped as a bad approximation. To use an official asset instead, drop the
   vendor SVG in and swap the component in BRAND_MARKS below: nothing else
   needs to change. */

import * as React from 'react';

export type MarkProps = { className?: string; style?: React.CSSProperties };

function Svg({
  label,
  className,
  style,
  children,
}: MarkProps & { label: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={style}
      role="img"
      aria-label={label}
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function ShopifyMark(p: MarkProps) {
  return (
    <Svg {...p} label="Shopify">
      <path
        fill="#95BF47"
        d="M15.34 4.32a.18.18 0 0 0-.16-.15c-.07 0-1.4-.03-1.4-.03s-1.11-1.08-1.22-1.19c-.11-.11-.33-.08-.41-.05l-.56.17C11.25 2.14 10.7 1.3 9.72 1.3h-.09c-.28-.36-.63-.52-.93-.52-2.33 0-3.44 2.91-3.79 4.39l-1.63.5c-.5.16-.52.17-.58.65-.05.36-1.37 10.6-1.37 10.6l10.28 1.93 5.57-1.35s-1.83-12.37-1.84-12.45zM11.06 3.27l-.9.28c0-.06 0-.13.01-.2 0-.66-.09-1.19-.24-1.61.6.08.99.75 1.13 1.53zM9.28 1.85c.17.42.28.99.28 1.76v.12l-1.86.58c.36-1.37 1.03-2.04 1.58-2.46zM8.57 1.18c.1 0 .2.03.29.1-.72.34-1.5 1.2-1.83 2.92l-1.47.45C5.96 3.28 6.9 1.18 8.57 1.18z"
      />
      <path
        fill="#5E8E3E"
        d="M15.18 4.17c-.07 0-1.4-.03-1.4-.03s-1.11-1.08-1.22-1.19a.27.27 0 0 0-.15-.07l-.78 15.94 5.57-1.35s-1.83-12.37-1.84-12.45a.18.18 0 0 0-.18-.85z"
      />
      <path
        fill="#FFF"
        transform="translate(2.4 0)"
        d="M9.72 6.9l-.69 2.04s-.61-.32-1.35-.32c-1.09 0-1.14.68-1.14.85 0 .93 2.44 1.29 2.44 3.48 0 1.72-1.09 2.83-2.56 2.83-1.77 0-2.67-1.1-2.67-1.1l.47-1.56s.93.8 1.71.8c.51 0 .72-.4.72-.7 0-1.22-2-1.27-2-3.27 0-1.69 1.21-3.32 3.66-3.32.94 0 1.41.27 1.41.27z"
      />
    </Svg>
  );
}

export function GeminiMark(p: MarkProps) {
  return (
    <Svg {...p} label="Google Gemini">
      <defs>
        <linearGradient id="gc-gemini-gradient" x1="0" y1="24" x2="24" y2="0">
          <stop offset="0" stopColor="#4285F4" />
          <stop offset="0.52" stopColor="#9B72CB" />
          <stop offset="1" stopColor="#D96570" />
        </linearGradient>
      </defs>
      {/* Four-pointed spark: each side is a quarter arc pulled to the centre,
          which is what gives the mark its concave star silhouette. */}
      <path
        fill="url(#gc-gemini-gradient)"
        d="M12 0c0 6.63 5.37 12 12 12-6.63 0-12 5.37-12 12 0-6.63-5.37-12-12-12C6.63 12 12 6.63 12 0z"
      />
    </Svg>
  );
}

export function VercelMark(p: MarkProps) {
  return (
    <Svg {...p} label="Vercel">
      <path fill="currentColor" d="M12 2 23 21H1z" />
    </Svg>
  );
}

export function MicrosoftMark(p: MarkProps) {
  return (
    <Svg {...p} label="Microsoft">
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M13 1h10v10H13z" />
      <path fill="#00A4EF" d="M1 13h10v10H1z" />
      <path fill="#FFB900" d="M13 13h10v10H13z" />
    </Svg>
  );
}

export function SlackMark(p: MarkProps) {
  return (
    <Svg {...p} label="Slack">
      {/* Four rounded bars in rotational symmetry, one per brand colour. */}
      <rect x="9.4" y="1" width="4.2" height="11.4" rx="2.1" fill="#36C5F0" />
      <rect x="1" y="10.4" width="11.4" height="4.2" rx="2.1" fill="#2EB67D" />
      <rect x="10.4" y="11.6" width="4.2" height="11.4" rx="2.1" fill="#ECB22E" />
      <rect x="11.6" y="9.4" width="11.4" height="4.2" rx="2.1" fill="#E01E5A" />
    </Svg>
  );
}

export function ZapierMark(p: MarkProps) {
  return (
    <Svg {...p} label="Zapier">
      {/* Six-point asterisk: three bars at 0, 60 and 120 degrees. */}
      <g fill="#FF4F00">
        <rect x="10.1" y="2" width="3.8" height="20" rx="1.9" />
        <rect x="10.1" y="2" width="3.8" height="20" rx="1.9" transform="rotate(60 12 12)" />
        <rect x="10.1" y="2" width="3.8" height="20" rx="1.9" transform="rotate(120 12 12)" />
      </g>
    </Svg>
  );
}

export function InstagramMark(p: MarkProps) {
  return (
    <Svg {...p} label="Instagram">
      <rect
        x="2.2"
        y="2.2"
        width="19.6"
        height="19.6"
        rx="5.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12" cy="12" r="4.6" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.6" cy="6.4" r="1.3" fill="currentColor" />
    </Svg>
  );
}

export function WhatsAppMark(p: MarkProps) {
  return (
    <Svg {...p} label="WhatsApp">
      <circle cx="12" cy="12" r="11" fill="#25D366" />
      {/* Handset: two rounded lobes joined by the diagonal shank. */}
      <path
        fill="#FFF"
        d="M8.9 6.9c-.25-.56-.5-.5-.72-.5h-.6c-.21 0-.55.08-.84.39-.29.31-1.1 1.07-1.1 2.6s1.13 3.02 1.28 3.23c.16.21 2.18 3.48 5.38 4.74 2.66 1.05 3.2.84 3.78.79.58-.05 1.87-.76 2.13-1.5.26-.74.26-1.37.19-1.5-.08-.13-.29-.21-.6-.37-.31-.16-1.87-.92-2.16-1.03-.29-.1-.5-.16-.71.16-.21.31-.81 1.02-.99 1.23-.18.21-.37.24-.68.08-.31-.16-1.34-.49-2.55-1.57-.94-.84-1.58-1.87-1.76-2.19-.18-.31-.02-.48.14-.64.14-.14.31-.37.47-.55.16-.18.21-.31.31-.52.11-.21.05-.39-.02-.55-.08-.16-.7-1.72-.95-2.3z"
      />
    </Svg>
  );
}

export function TelegramMark(p: MarkProps) {
  return (
    <Svg {...p} label="Telegram">
      <circle cx="12" cy="12" r="11" fill="#229ED9" />
      <path
        fill="#FFF"
        d="M5.8 11.9l11-4.24c.51-.19.96.12.79.9l-1.87 8.83c-.14.63-.52.79-1.05.49l-2.9-2.14-1.4 1.35c-.15.15-.29.29-.59.29l.21-3 5.46-4.93c.24-.21-.05-.33-.36-.13l-6.75 4.25-2.91-.91c-.63-.2-.65-.63.12-.93z"
      />
    </Svg>
  );
}

export function N8nMark(p: MarkProps) {
  return (
    <Svg {...p} label="n8n">
      {/* Three nodes on a wire: the workflow-graph idea the product is named for. */}
      <g stroke="#EA4B71" strokeWidth="1.8" fill="none">
        <path d="M5.5 12h5M13.5 8.5h5M13.5 15.5h5" />
      </g>
      <g fill="#EA4B71">
        <circle cx="3.6" cy="12" r="2.6" />
        <circle cx="12" cy="12" r="2.2" />
        <circle cx="20.4" cy="8.5" r="2.4" />
        <circle cx="20.4" cy="15.5" r="2.4" />
      </g>
    </Svg>
  );
}

export function SupabaseMark(p: MarkProps) {
  return (
    <Svg {...p} label="Supabase">
      <defs>
        <linearGradient id="gc-supabase-gradient" x1="6" y1="2" x2="18" y2="22">
          <stop offset="0" stopColor="#3ECF8E" />
          <stop offset="1" stopColor="#249361" />
        </linearGradient>
      </defs>
      {/* Bolt: the lower half solid, the upper half the lighter reflection. */}
      <path fill="url(#gc-supabase-gradient)" d="M12.6 22.6c-.5.63-1.5.28-1.5-.52V13.6h6.9c.9 0 1.4 1.03.84 1.73z" />
      <path fill="#3ECF8E" opacity="0.75" d="M11.4 1.4c.5-.63 1.5-.28 1.5.52v8.48H6c-.9 0-1.4-1.03-.84-1.73z" />
    </Svg>
  );
}

export function NotionMark(p: MarkProps) {
  return (
    <Svg {...p} label="Notion">
      <rect
        x="2.5"
        y="2.5"
        width="19"
        height="19"
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      {/* The N: two stems and the diagonal, drawn as strokes so it stays even. */}
      <path
        d="M8.4 16.6V7.4l7.2 9.2V7.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/* Lookup used by the landing strips. Keys match the untranslated brand names
   in the copy dictionaries, which stay Latin script in Arabic too. */
export const BRAND_MARKS: Record<string, ((props: MarkProps) => React.JSX.Element) | undefined> = {
  Shopify: ShopifyMark,
  Gemini: GeminiMark,
  Vercel: VercelMark,
  Microsoft: MicrosoftMark,
  Slack: SlackMark,
  Zapier: ZapierMark,
  Instagram: InstagramMark,
  WhatsApp: WhatsAppMark,
  Telegram: TelegramMark,
  n8n: N8nMark,
  Supabase: SupabaseMark,
  Notion: NotionMark,
};
