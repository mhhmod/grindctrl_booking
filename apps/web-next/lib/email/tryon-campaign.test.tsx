import { describe, expect, it } from 'vitest';
import { renderTryonCampaignEmail, TRYON_LOGO_CID, TRYON_PROOF_CID } from '@/lib/email/tryon-campaign';

const mojibakePatterns = ['â€™', 'â€œ', 'â€', 'Ã', 'Â'];

describe('GrindCTRL Try-On campaign email', () => {
  it.each([1, 2, 3, 4] as const)('renders touch %s with safe UTF-8 content and both CTA paths', async (touch) => {
    const rendered = await renderTryonCampaignEmail({
      touch,
      businessName: 'M10 Sabry',
      logoSrc: `cid:${TRYON_LOGO_CID}`,
      proofImageSrc: `cid:${TRYON_PROOF_CID}`,
    });

    expect(rendered.subject).toBe(touch === 1
      ? '◉ Let shoppers see it before they buy'
      : 'Re: ◉ Let shoppers see it before they buy');
    expect(rendered.html.toLowerCase()).toContain('charset=utf-8');
    expect(rendered.html).toContain(`cid:${TRYON_LOGO_CID}`);
    expect(rendered.html).toContain('Reply DEMO');
    expect(rendered.html).toContain('https://grindctrl.cloud/try-on');
    expect(rendered.text).toContain('Reply DEMO');
    expect(rendered.text).toContain('Open the live demo');
    for (const broken of mojibakePatterns) {
      expect(rendered.html).not.toContain(broken);
      expect(rendered.text).not.toContain(broken);
      expect(rendered.subject).not.toContain(broken);
    }
  });

  it('includes the unchanged proof image only on touches 1 and 3', async () => {
    for (const touch of [1, 3] as const) {
      const rendered = await renderTryonCampaignEmail({ touch, businessName: 'M10 Sabry' });
      expect(rendered.html).toContain(`cid:${TRYON_PROOF_CID}`);
    }

    for (const touch of [2, 4] as const) {
      const rendered = await renderTryonCampaignEmail({ touch, businessName: 'M10 Sabry' });
      expect(rendered.html).not.toContain(`cid:${TRYON_PROOF_CID}`);
    }
  });

  it('personalizes the reply subject without injecting HTML', async () => {
    const rendered = await renderTryonCampaignEmail({
      touch: 1,
      businessName: '<script>alert(1)</script>',
      recipientName: 'Nora & team',
    });

    expect(rendered.html).not.toContain('<script>alert(1)</script>');
    expect(rendered.html).toContain('Nora &amp; team');
    expect(rendered.html).toContain('%3Cscript%3Ealert(1)%3C%2Fscript%3E');
  });
});
