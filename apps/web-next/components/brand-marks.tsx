/* Third-party brand marks, used nominatively to show what we work with.

   These come from simple-icons, which ships each vendor's official path
   geometry and official brand colour. The previous version reconstructed
   the shapes by hand and they looked wrong, because eyeballing a logo from
   memory does not survive contact with a real one.

   simple-icons marks are single-path and monochrome by design. Each is
   rendered in its own brand colour, which is how a logo strip normally
   reads. Marks whose official colour is essentially black switch to
   currentColor so they stay visible in dark mode instead of disappearing
   into the background.

   Not available in simple-icons: OpenAI, Slack, and Microsoft. Those
   companies ask to be excluded on trademark grounds, so they are absent
   here rather than hand-drawn. If one is needed later, add the official
   asset the vendor publishes and register it below. */

import * as React from 'react';
import {
  siAirtable,
  siAnthropic,
  siClaude,
  siFacebook,
  siGithub,
  siGooglegemini,
  siHubspot,
  siInstagram,
  siLinear,
  siMake,
  siMeta,
  siN8n,
  siNotion,
  siOpenrouter,
  siSalla,
  siShopify,
  siStripe,
  siSupabase,
  siTelegram,
  siTiktok,
  siVercel,
  siWhatsapp,
  siWoo,
  siWoocommerce,
  siZapier,
} from 'simple-icons';

export type MarkProps = {
  className?: string;
  style?: React.CSSProperties;
  /** Ink or cream instead of the brand colour, for marks set inside monochrome UI. */
  monochrome?: boolean;
  /** Hidden from assistive technology when a visible name sits right beside it. */
  decorative?: boolean;
};

type SimpleIcon = { title: string; hex: string; path: string };

/* Brand colours this dark vanish against a dark background. Falling back to
   currentColor keeps the mark legible in both themes, which matters more
   than a literal hex nobody can see. */
const NEAR_BLACK = /^(0{6}|1[0-9a-f]{5})$/i;

function markFill(icon: SimpleIcon): string {
  return NEAR_BLACK.test(icon.hex) ? 'currentColor' : `#${icon.hex}`;
}

function makeMark(icon: SimpleIcon) {
  function Mark({ className, style, monochrome = false, decorative = false }: MarkProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        style={style}
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : icon.title}
        aria-hidden={decorative ? true : undefined}
        focusable="false"
        fill={monochrome ? 'currentColor' : markFill(icon)}
      >
        <path d={icon.path} />
      </svg>
    );
  }
  Mark.displayName = `${icon.title.replace(/\W/g, '')}Mark`;
  return Mark;
}

export const ShopifyMark = makeMark(siShopify);
export const GeminiMark = makeMark(siGooglegemini);
export const ClaudeMark = makeMark(siClaude);
export const AnthropicMark = makeMark(siAnthropic);
export const MetaMark = makeMark(siMeta);
export const WhatsAppMark = makeMark(siWhatsapp);
export const InstagramMark = makeMark(siInstagram);
export const FacebookMark = makeMark(siFacebook);
export const TelegramMark = makeMark(siTelegram);
export const TikTokMark = makeMark(siTiktok);
export const ZapierMark = makeMark(siZapier);
export const MakeMark = makeMark(siMake);
export const N8nMark = makeMark(siN8n);
export const NotionMark = makeMark(siNotion);
export const SupabaseMark = makeMark(siSupabase);
export const VercelMark = makeMark(siVercel);
export const GithubMark = makeMark(siGithub);
export const HubspotMark = makeMark(siHubspot);
export const StripeMark = makeMark(siStripe);
export const AirtableMark = makeMark(siAirtable);
export const LinearMark = makeMark(siLinear);
export const WooCommerceMark = makeMark(siWoocommerce);
export const OpenRouterMark = makeMark(siOpenrouter);
/* Salla's official colour is a pale mint that disappears on a light page, so
   callers render this one with `monochrome`. Zid has no simple-icons mark and
   is shown as its name in text rather than a drawn imitation. */
export const SallaMark = makeMark(siSalla);

/* Full-colour platform logos for the places that name a commerce platform
   (landing stack scene, integrations page). These are the vendors' official
   colours and are the one deliberate exception to "tokens only": they must
   not be themed, so light and dark mode show the same logo. Salla and Zid
   sit on their own app-icon tile because their mark colour alone vanishes
   on a card; Shopify and Woo are legible on both card surfaces as-is
   (Woo #873EFF is about 5:1 on cream and 3.5:1 on the dark card). */
export const BRAND_COLORS = {
  shopify: '#95BF47',
  woo: '#873EFF',
  sallaTile: '#004956',
  sallaMark: '#BAF3E6',
  zidTile: '#AE72FF',
  zidMark: '#1F0433',
} as const;

export type LogoProps = {
  /** Rendered height in px. Width follows the logo's own aspect ratio. */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Gives the logo an accessible name. Omit when a visible name sits beside it. */
  title?: string;
};

function logoProps({ size = 20, className, style, title }: LogoProps, aspect = 1) {
  return {
    width: size * aspect,
    height: size,
    className,
    style: { flexShrink: 0, ...style },
    focusable: 'false' as const,
    ...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true as const }),
  };
}

export function ShopifyLogo(props: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" {...logoProps(props)} fill={BRAND_COLORS.shopify}>
      <path d={siShopify.path} />
    </svg>
  );
}

/* siWoo is the "Woo" wordmark: 24 wide but only about 6.3 tall, so the box is
   cropped to it and rendered at its natural 3.75:1 ratio. */
export function WooCommerceLogo(props: LogoProps) {
  return (
    <svg viewBox="0 8.8 24 6.4" {...logoProps(props, 24 / 6.4)} fill={BRAND_COLORS.woo}>
      <path d={siWoo.path} />
    </svg>
  );
}

export function SallaLogo(props: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" {...logoProps(props)}>
      <rect width="24" height="24" rx="5" fill={BRAND_COLORS.sallaTile} />
      <path d={siSalla.path} fill={BRAND_COLORS.sallaMark} transform="translate(4.2 4.2) scale(.65)" />
    </svg>
  );
}

/* Official Zid mark, exact rect and path from https://zid.sa/icon.svg. */
export function ZidLogo(props: LogoProps) {
  return (
    <svg viewBox="0 0 4976 4976" {...logoProps(props)}>
      <rect width="4976" height="4976" rx="657" fill={BRAND_COLORS.zidTile} />
      <g transform="translate(23.63 0.3)">
        <path
          fill={BRAND_COLORS.zidMark}
          fillRule="evenodd"
          d="M2464.37 1159.92C2381.25 1159.92 2314.46 1226.71 2314.46 1309.83C2314.46 1478.31 2367.63 1641.55 2464.37 1776.93C2561.12 1641.55 2614.28 1478.16 2614.28 1309.83C2614.28 1226.71 2547.49 1159.92 2464.37 1159.92ZM2664.15 1992.14C2818.26 1799.4 2903.47 1558.88 2903.47 1309.83C2903.47 1060.77 2707.29 870.727 2464.37 870.727C2221.46 870.727 2025.27 1067.06 2025.27 1309.83C2025.27 1552.59 2110.64 1799.55 2264.59 1992.14L1968.81 2287.92C1776.07 2133.82 1535.55 2048.6 1286.5 2048.6C1037.44 2048.6 847.396 2244.94 847.396 2487.7C847.396 2730.47 1043.73 2926.8 1286.5 2926.8C1529.26 2926.8 1776.22 2841.44 1968.81 2687.48L2264.59 2983.26C2110.49 3176.01 2025.27 3416.52 2025.27 3665.58C2025.27 3914.63 2221.61 4104.68 2464.37 4104.68C2707.14 4104.68 2903.47 3908.34 2903.47 3665.58C2903.47 3422.81 2818.11 3175.86 2664.15 2983.26L2959.93 2687.48C3152.68 2841.59 3393.19 2926.8 3642.25 2926.8C3891.3 2926.8 4081.35 2730.47 4081.35 2487.7C4081.35 2244.94 3885.01 2048.6 3642.25 2048.6C3399.48 2048.6 3152.53 2133.97 2959.93 2287.92L2664.15 1992.14ZM2464.37 2201.51L2178.03 2487.85L2464.37 2774.2L2750.72 2487.85L2464.37 2201.51ZM3175.14 2487.7C3310.52 2584.45 3473.91 2637.61 3642.25 2637.61C3725.36 2637.61 3792.16 2570.82 3792.16 2487.7C3792.16 2404.58 3725.36 2337.79 3642.25 2337.79C3473.77 2337.79 3310.52 2390.96 3175.14 2487.7ZM2464.37 3198.47C2367.63 3333.86 2314.46 3497.24 2314.46 3665.58C2314.46 3748.69 2381.25 3815.49 2464.37 3815.49C2547.49 3815.49 2614.28 3748.69 2614.28 3665.58C2614.28 3497.1 2561.12 3333.86 2464.37 3198.47ZM1753.6 2487.7C1618.22 2390.96 1454.83 2337.79 1286.5 2337.79C1203.38 2337.79 1136.59 2404.58 1136.59 2487.7C1136.59 2570.82 1203.38 2637.61 1286.5 2637.61C1454.98 2637.61 1618.22 2584.45 1753.6 2487.7Z"
        />
      </g>
    </svg>
  );
}

/* Lookup used by the landing strips. Keys match the untranslated brand names
   in the copy dictionaries, which stay Latin script in Arabic too. */
export const BRAND_MARKS: Record<string, ((props: MarkProps) => React.JSX.Element) | undefined> = {
  Shopify: ShopifyMark,
  WooCommerce: WooCommerceMark,
  Salla: SallaMark,
  Gemini: GeminiMark,
  Claude: ClaudeMark,
  Anthropic: AnthropicMark,
  Meta: MetaMark,
  WhatsApp: WhatsAppMark,
  Instagram: InstagramMark,
  Facebook: FacebookMark,
  Telegram: TelegramMark,
  TikTok: TikTokMark,
  Zapier: ZapierMark,
  Make: MakeMark,
  n8n: N8nMark,
  Notion: NotionMark,
  Supabase: SupabaseMark,
  Vercel: VercelMark,
  GitHub: GithubMark,
  HubSpot: HubspotMark,
  Stripe: StripeMark,
  Airtable: AirtableMark,
  Linear: LinearMark,
  OpenRouter: OpenRouterMark,
};
