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
  siShopify,
  siStripe,
  siSupabase,
  siTelegram,
  siTiktok,
  siVercel,
  siWhatsapp,
  siWoocommerce,
  siZapier,
} from 'simple-icons';

export type MarkProps = { className?: string; style?: React.CSSProperties };

type SimpleIcon = { title: string; hex: string; path: string };

/* Brand colours this dark vanish against a dark background. Falling back to
   currentColor keeps the mark legible in both themes, which matters more
   than a literal hex nobody can see. */
const NEAR_BLACK = /^(0{6}|1[0-9a-f]{5})$/i;

function markFill(icon: SimpleIcon): string {
  return NEAR_BLACK.test(icon.hex) ? 'currentColor' : `#${icon.hex}`;
}

function makeMark(icon: SimpleIcon) {
  function Mark({ className, style }: MarkProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        style={style}
        role="img"
        aria-label={icon.title}
        focusable="false"
        fill={markFill(icon)}
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

/* Lookup used by the landing strips. Keys match the untranslated brand names
   in the copy dictionaries, which stay Latin script in Arabic too. */
export const BRAND_MARKS: Record<string, ((props: MarkProps) => React.JSX.Element) | undefined> = {
  Shopify: ShopifyMark,
  WooCommerce: WooCommerceMark,
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
};
