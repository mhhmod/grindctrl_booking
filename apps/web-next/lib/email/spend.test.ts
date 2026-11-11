// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildSpendEmail } from './spend';
describe('platform email', () => {
 it('renders English HTML and plain text', () => {
   const email = buildSpendEmail({ feature: 'Try-On', threshold: 80, used: 4000, limit: 5000, topStores: [{ store: 'lulu.myshopify.com', used: 250 }] });
   expect(email).toMatchSnapshot(); expect(email.text).toContain('Open operator tools: https://grindctrl.cloud/dashboard/settings');
   expect(email.text).toContain('Used: 4000'); expect(email.html.match(/<h1/g)).toHaveLength(1);
 });
 it('escapes names and limits top stores to three', () => {
   const email = buildSpendEmail({ feature: 'Store Chat', threshold: 100, store: '<store>', used: 2000, limit: 2000,
     topStores: [1,2,3,4].map(n => ({ store: '<name-' + n + '>', used: n })) });
   expect(email.html).toContain('&lt;store&gt;'); expect(email.html).not.toContain('<store>'); expect(email.text).not.toContain('name-4');
 });
});
