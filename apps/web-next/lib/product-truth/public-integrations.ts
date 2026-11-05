export const PUBLIC_INTEGRATION_STATES = [
  'implemented',
  'in-testing',
  'setup-required',
  'evidence-required',
  'planned',
  'infrastructure',
] as const;

export type PublicIntegrationState = (typeof PUBLIC_INTEGRATION_STATES)[number];

export type PublicIntegration = {
  id: string;
  name: string;
  state: PublicIntegrationState;
  evidenceRef: string | null;
  note: string;
};

/**
 * Public relationship depth for the brand marks shown on the landing page.
 * A listed technology is not automatically a native or live tenant connection.
 *
 * `implemented` is per scope: the note says what it covers (a platform may be
 * live for only some features, and the note says which). `in-testing` means the code is on `main` but not yet
 * verified on a live store, and not offered to merchants. Never word it as
 * supported, available or works with. `docs/platform-readiness-matrix.md` is
 * the evidence behind the platform rows.
 */
export const PUBLIC_INTEGRATIONS = [
  {
    id: 'shopify',
    name: 'Shopify',
    state: 'implemented',
    evidenceRef: 'apps/grindctrl-tryon',
    note: 'Embedded app, app proxy, webhooks and theme-extension blocks exist.',
  },
  {
    id: 'woocommerce',
    name: 'WooCommerce',
    state: 'implemented',
    evidenceRef: 'docs/superpowers/checkpoints/2026-11-05-woocommerce-parity-live.md',
    note: 'Try-On, Store Chat and order status, through the GRINDCTRL WordPress plugin on a DNS-verified domain. Verified on a live store against production on 2026-11-05. Paid plans are arranged with GRINDCTRL.',
  },
  {
    id: 'custom-website',
    name: 'Your website',
    state: 'in-testing',
    evidenceRef: 'docs/platform-readiness-matrix.md',
    note: 'Store Chat only, by script tag on a DNS-verified domain. Code is on main and being verified; not available to merchants yet. No Try-On, order lookup or native product sync.',
  },
  {
    id: 'salla',
    name: 'Salla',
    state: 'planned',
    evidenceRef: 'docs/platform-readiness-matrix.md',
    note: 'Next in the build order. No code connects a Salla store yet.',
  },
  {
    id: 'zid',
    name: 'Zid',
    state: 'planned',
    evidenceRef: 'docs/platform-readiness-matrix.md',
    note: 'After Salla in the build order. No code connects a Zid store yet.',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    state: 'evidence-required',
    evidenceRef: null,
    note: 'No repository evidence currently supports presenting this as ready for setup or use.',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    state: 'evidence-required',
    evidenceRef: null,
    note: 'No repository evidence currently supports presenting this as ready for setup or use.',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    state: 'planned',
    evidenceRef: 'docs/grindctrl-product-roadmap.md',
    note: 'The product roadmap names this as a planned channel. No code exists yet.',
  },
  {
    id: 'zapier',
    name: 'Zapier',
    state: 'evidence-required',
    evidenceRef: null,
    note: 'No repository evidence currently supports presenting this as planned, ready for setup or in use.',
  },
  {
    id: 'make',
    name: 'Make',
    state: 'evidence-required',
    evidenceRef: null,
    note: 'No repository evidence currently supports presenting this as planned, ready for setup or in use.',
  },
  {
    id: 'n8n',
    name: 'n8n',
    state: 'setup-required',
    evidenceRef: 'apps/web-next/docs/n8n-next-workflow-queue.md',
    note: 'Implementation is workflow-specific and does not imply a native connector.',
  },
  {
    id: 'groq',
    name: 'Groq',
    state: 'infrastructure',
    evidenceRef: 'apps/web-next/lib/assistant/groq-client.ts',
    note: 'Internal AI infrastructure for the site assistant chat, speech-to-text and text-to-speech. Not a merchant-connectable tool.',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    state: 'infrastructure',
    evidenceRef: 'apps/web-next/lib/try-on/image-runner.ts',
    note: 'Internal AI infrastructure that routes Try-On image generation, Store Chat replies (apps/web-next/lib/messenger/chat-client.ts) and messenger attachment/vision triage (apps/web-next/lib/messenger/vision-client.ts) to swappable underlying models. Not a merchant-connectable tool.',
  },
  {
    id: 'notion',
    name: 'Notion',
    state: 'evidence-required',
    evidenceRef: null,
    note: 'No repository evidence currently supports presenting this as planned, ready for setup or in use.',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    state: 'evidence-required',
    evidenceRef: null,
    note: 'No HubSpot connector exists in the product, and no repository evidence supports presenting one as ready for setup or use.',
  },
  {
    id: 'supabase',
    name: 'Supabase',
    state: 'infrastructure',
    evidenceRef: 'apps/web-next/lib/supabase/server.ts',
    note: 'Used as application infrastructure rather than presented as a merchant connector.',
  },
] as const satisfies readonly PublicIntegration[];

export function findPublicIntegration(id: string): PublicIntegration | undefined {
  return PUBLIC_INTEGRATIONS.find((integration) => integration.id === id);
}
