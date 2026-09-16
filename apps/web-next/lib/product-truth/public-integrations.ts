export const PUBLIC_INTEGRATION_STATES = [
  'implemented',
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
    evidenceRef: 'apps/web-next/lib/dashboard/integration-catalog.ts',
    note: 'The current integration catalogue marks this relationship as planned.',
  },
  {
    id: 'zapier',
    name: 'Zapier',
    state: 'planned',
    evidenceRef: 'apps/web-next/lib/dashboard/integration-catalog.ts',
    note: 'The current integration catalogue marks this relationship as planned.',
  },
  {
    id: 'make',
    name: 'Make',
    state: 'planned',
    evidenceRef: 'apps/web-next/lib/dashboard/integration-catalog.ts',
    note: 'The current integration catalogue marks this relationship as planned.',
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
    note: 'Internal AI infrastructure for chat, speech-to-text and text-to-speech. Not a merchant-connectable tool.',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    state: 'infrastructure',
    evidenceRef: 'apps/web-next/lib/try-on/image-runner.ts',
    note: 'Internal AI infrastructure that routes Try-On image generation and messenger attachment/vision triage (apps/web-next/lib/messenger/vision-client.ts) to swappable underlying models. Not a merchant-connectable tool.',
  },
  {
    id: 'notion',
    name: 'Notion',
    state: 'planned',
    evidenceRef: 'apps/web-next/lib/dashboard/integration-catalog.ts',
    note: 'The current integration catalogue marks this relationship as planned.',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    state: 'setup-required',
    evidenceRef: 'apps/web-next/lib/dashboard/integration-catalog.ts',
    note: 'Available through implementation; not proven as connected for every tenant.',
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
