import 'server-only';
import { pasteLiquidSecret } from './signing';
import type { PasteConnection, PasteSnippet } from './types';
import { PasteError } from './types';

const LOADER = 'https://grindctrl.cloud/widget/v1/messenger.js';
const CONTEXT_ENDPOINT = '/api/try-on/paste-context' as const;

/** Only the owner-authorized action calls this. The Liquid secret occurs
 * solely in a Liquid tag; Liquid emits the MAC, never the secret, into HTML. */
export function buildPasteSnippet(connection: PasteConnection, embedKey: string): PasteSnippet {
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(embedKey)) throw new PasteError('unavailable');
  const base = `<script async src="${LOADER}" data-key="${embedKey}" data-gc-install="paste"`;
  if (connection.platform === 'website') return {
    platform: 'website', contextEndpoint: CONTEXT_ENDPOINT,
    snippet: `${base} data-gc-platform="website"></script>`,
    steps: [{ kind: 'open', target: 'website_html' }, { kind: 'paste', target: 'before_body_end' }, { kind: 'save' }, { kind: 'visit', target: 'trusted_domain' }],
  };
  const secret = pasteLiquidSecret(connection.widget_site_id, connection.secret_version);
  if (!secret) throw new PasteError('unavailable');
  return {
    platform: 'shopify', contextEndpoint: CONTEXT_ENDPOINT,
    snippet: `{%- assign gc_issued_at = 'now' | date: '%s' -%}
{%- assign gc_variant = product.selected_or_first_available_variant.id -%}
{%- capture gc_message -%}gc-paste-v1|${connection.widget_site_id}|{{ shop.permanent_domain }}|{{ product.id }}|{{ gc_variant }}|{{ gc_issued_at }}|{{ customer.id }}{%- endcapture -%}
{%- assign gc_signature = gc_message | hmac_sha256: '${secret}' -%}
${base} data-gc-platform="shopify" data-gc-site="${connection.widget_site_id}" data-gc-shop="{{ shop.permanent_domain | escape }}" data-gc-product="{{ product.id }}" data-gc-variant="{{ gc_variant }}" data-gc-issued-at="{{ gc_issued_at }}" data-gc-customer="{{ customer.id }}" data-gc-signature="{{ gc_signature }}"></script>`,
    steps: [{ kind: 'open', target: 'shopify_theme_editor' }, { kind: 'select', target: 'footer' },
      { kind: 'select', target: 'custom_liquid' }, { kind: 'paste', target: 'custom_liquid' }, { kind: 'save' }, { kind: 'visit', target: 'product_page' }],
  };
}
