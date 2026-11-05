import { BOOKING_URL } from '@/lib/booking';
import { findPublicIntegration, type PublicIntegrationState } from '@/lib/product-truth/public-integrations';

/* /llms.txt: a plain-text description of GRINDCTRL for language models and
   crawlers. Platform status is read from the product-truth register, so this
   file cannot say a platform is further along than the register does. */

/** The word a reader sees for each register state. "Supported", "available"
 *  and "works with" are deliberately absent: only Live may sound like that. */
const STATUS_WORD: Record<PublicIntegrationState, string> = {
  implemented: 'Live',
  'in-testing': 'In testing',
  'setup-required': 'Setup required',
  'evidence-required': 'Not built',
  planned: 'Planned',
  infrastructure: 'Infrastructure',
};

const PLATFORMS = [
  { id: 'shopify', detail: 'Try-On, Store Chat and read-only order status.' },
  {
    id: 'woocommerce',
    detail: 'Try-On, Store Chat and order status, through the GRINDCTRL WordPress plugin on a domain verified with DNS.',
  },
  {
    id: 'custom-website',
    detail: 'Store Chat only, by script tag on a domain verified with DNS. No Try-On, order lookup or product sync.',
  },
  { id: 'salla', detail: 'No code yet. Next in the build order.' },
  { id: 'zid', detail: 'No code yet. After Salla.' },
] as const;

/** Public pages with a one-line description each. Paths are the sitemap's. */
export const LLMS_PAGES = [
  { path: '/', title: 'Home', detail: 'What GRINDCTRL is and a walk through the product.' },
  { path: '/try-on', title: 'Try-On demo', detail: 'The AI try-on on a demo Shopify store.' },
  { path: '/shopping', title: 'AI Shopping', detail: 'How Try-On works for shoppers, including photo privacy and deletion.' },
  {
    path: '/conversations',
    title: 'AI Conversations',
    detail: 'Store Chat: answers from your store knowledge, read-only order lookup on Shopify and WooCommerce, handoff to your team.',
  },
  { path: '/operations', title: 'Commerce Operations', detail: 'Team inbox, takeover, and what is not live yet.' },
  { path: '/integrations', title: 'Integrations', detail: 'The status of every platform and integration, checked against the code.' },
  { path: '/pricing', title: 'Pricing', detail: 'Plans, monthly try-on credits and top-up packs.' },
  { path: '/roi', title: 'ROI calculator', detail: 'An estimate built from your own store numbers, with every assumption editable.' },
  { path: '/security', title: 'Security', detail: 'How store and shopper data is handled.' },
] as const;

export function buildLlmsTxt(origin: string): string {
  const platforms = PLATFORMS.map(({ id, detail }) => {
    const integration = findPublicIntegration(id);
    if (!integration) throw new Error(`llms.txt references unknown register id: ${id}`);
    return `- ${integration.name}: ${STATUS_WORD[integration.state]}. ${detail}`;
  });
  const pages = LLMS_PAGES.map(({ path, title, detail }) => `- [${title}](${origin}${path}): ${detail}`);

  return [
    '# GRINDCTRL',
    '',
    '> GRINDCTRL gives fashion stores AI virtual try-on and an AI Store Chat, in English and Arabic. Shoppers see your clothes on themselves from one photo and get answers from your store. It is live on Shopify and WooCommerce.',
    '',
    '## Platform status',
    '',
    ...platforms,
    '',
    'Paid plans are billed through Shopify for Shopify stores and arranged with GRINDCTRL for WooCommerce stores. The current status of every integration is on the integrations page.',
    '',
    '## Pages',
    '',
    ...pages,
    '',
    '## Contact',
    '',
    `- [Book a call](${BOOKING_URL})`,
    '',
  ].join('\n');
}
