import 'server-only';
import { pasteLiquidSecret } from './signing';
import type { PasteConnection, PasteSnippet } from './types';
import { PASTE_CARD_LIMIT, PASTE_SHOPIFY_CODE_VERSION, PasteError } from './types';

const LOADER = 'https://grindctrl.cloud/widget/v1/messenger.js';
const CONTEXT_ENDPOINT = '/api/try-on/paste-context' as const;

/** The signed message for one product, the same format as the product
 *  page's (lib/paste/signing.ts liquidSignedMessage), built from Liquid. */
function liquidMessage(siteId: string, productId: string, variantId: string): string {
  return `gc-paste-v1|${siteId}|{{ shop.permanent_domain }}|{{ ${productId} }}|{{ ${variantId} }}|{{ gc_issued_at }}|{{ customer.id }}`;
}

/** Shopify Footer > Custom Liquid. The derived secret occurs once, in an
 *  assign tag: Liquid emits MACs, never the secret, into HTML.
 *
 *  On product listings (collection, search, the home page) it also prints
 *  up to PASTE_CARD_LIMIT signed product cards as JSON, before the loader
 *  tag so the loader always finds them. Each card is signed exactly like
 *  the product page, with that product's id and its selected or first
 *  available variant (sold-out products included, as in the Shopify app).
 *  One loop, no nested loops over variants. Every free-text value is HTML
 *  escaped and then JSON encoded, so no card can close the script element;
 *  the loader decodes the entities. */
function shopifySnippet(siteId: string, secret: string, base: string): string {
  return `{%- assign gc_key = '${secret}' -%}
{%- assign gc_issued_at = 'now' | date: '%s' -%}
{%- assign gc_variant = product.selected_or_first_available_variant.id -%}
{%- capture gc_message -%}${liquidMessage(siteId, 'product.id', 'gc_variant')}{%- endcapture -%}
{%- assign gc_signature = gc_message | hmac_sha256: gc_key -%}
{%- liquid
  assign gc_cards = nil
  case request.page_type
    when 'collection'
      assign gc_cards = collection.products
    when 'search'
      assign gc_cards = search.results
    when 'index'
      assign gc_cards = collections.all.products
  endcase
-%}
{%- if gc_cards != blank -%}
<script type="application/json" data-gc-cards="${siteId}">{"site":"${siteId}","shop":{{ shop.permanent_domain | json }},"issuedAt":"{{ gc_issued_at }}","customer":"{{ customer.id }}","products":[
{%- assign gc_count = 0 -%}
{%- for gc_item in gc_cards limit: ${PASTE_CARD_LIMIT} -%}
{%- if gc_item.object_type != blank and gc_item.object_type != 'product' -%}{%- continue -%}{%- endif -%}
{%- assign gc_card_variant = gc_item.selected_or_first_available_variant.id -%}
{%- if gc_card_variant == blank or gc_item.featured_image == blank -%}{%- continue -%}{%- endif -%}
{%- capture gc_card_message -%}${liquidMessage(siteId, 'gc_item.id', 'gc_card_variant')}{%- endcapture -%}
{%- if gc_count > 0 -%},{%- endif -%}
{"id":"{{ gc_item.id }}","variant":"{{ gc_card_variant }}","handle":{{ gc_item.handle | escape | json }},"title":{{ gc_item.title | escape | json }},"image":{{ gc_item.featured_image | image_url: width: 1200 | escape | json }},"signature":"{{ gc_card_message | hmac_sha256: gc_key }}"}
{%- assign gc_count = gc_count | plus: 1 -%}
{%- endfor -%}
]}</script>
{%- endif -%}
${base} data-gc-platform="shopify" data-gc-v="${PASTE_SHOPIFY_CODE_VERSION}" data-gc-site="${siteId}" data-gc-shop="{{ shop.permanent_domain | escape }}" data-gc-product="{{ product.id }}" data-gc-variant="{{ gc_variant }}" data-gc-issued-at="{{ gc_issued_at }}" data-gc-customer="{{ customer.id }}" data-gc-signature="{{ gc_signature }}"></script>`;
}

/** Only the owner-authorized action calls this. */
export function buildPasteSnippet(connection: PasteConnection, embedKey: string): PasteSnippet {
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(embedKey)) throw new PasteError('unavailable');
  const base = `<script async src="${LOADER}" data-key="${embedKey}" data-gc-install="paste"`;
  if (connection.platform === 'website') return {
    platform: 'website', codeVersion: null, contextEndpoint: CONTEXT_ENDPOINT,
    snippet: `${base} data-gc-platform="website"></script>`,
    steps: [{ kind: 'open', target: 'website_html' }, { kind: 'paste', target: 'before_body_end' }, { kind: 'save' }, { kind: 'visit', target: 'trusted_domain' }],
  };
  const secret = pasteLiquidSecret(connection.widget_site_id, connection.secret_version);
  if (!secret) throw new PasteError('unavailable');
  return {
    platform: 'shopify', codeVersion: PASTE_SHOPIFY_CODE_VERSION, contextEndpoint: CONTEXT_ENDPOINT,
    snippet: shopifySnippet(connection.widget_site_id, secret, base),
    steps: [{ kind: 'open', target: 'shopify_theme_editor' }, { kind: 'select', target: 'footer' },
      { kind: 'select', target: 'custom_liquid' }, { kind: 'paste', target: 'custom_liquid' }, { kind: 'save' }, { kind: 'visit', target: 'product_page' }],
  };
}
