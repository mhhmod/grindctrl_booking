import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { legalCopy, LEGAL_CONTACT_EMAIL, LEGAL_UPDATED } from './legal-copy';

describe('Published legal copy', () => {
  it.each(['privacy', 'terms'] as const)('keeps %s translations complete and source documents in sync', (page) => {
    const en = legalCopy[page].en;
    const ar = legalCopy[page].ar;
    const filename = page === 'privacy' ? 'privacy-policy-draft.md' : 'terms-of-service-draft.md';
    const source = readFileSync(join(process.cwd(), '../../docs/legal', filename), 'utf8');
    expect(source).toContain(`Published at /${page}`);
    expect(source).toContain(LEGAL_UPDATED);
    expect(ar.sections.map((section) => section.id)).toEqual(en.sections.map((section) => section.id));
    expect(new Set(en.sections.map((section) => section.id)).size).toBe(en.sections.length);
    const sourceSections = source.split(/^## \d+\. /m).slice(1);
    expect(sourceSections).toHaveLength(en.sections.length);

    for (const [index, section] of en.sections.entries()) {
      expect(source).toContain(section.title);
      for (const text of [...(section.paragraphs ?? []), ...(section.items ?? [])]) {
        expect(source).toContain(text);
      }
      // Compare the whole section so an omitted source paragraph cannot pass.
      const sourceBody = sourceSections[index].split(/\r?\n/).slice(1).join('\n').split('**Last updated:**')[0].trim();
      const publishedBody = [
        ...(section.paragraphs ?? []),
        ...(section.items ? [section.items.map((item) => `- ${item}`).join('\n')] : []),
      ].join('\n\n');
      expect(sourceBody).toBe(publishedBody);
      const translation = ar.sections[index];
      expect(translation.title).toMatch(/[\u0600-\u06ff]/);
      expect(translation.paragraphs?.length ?? 0).toBe(section.paragraphs?.length ?? 0);
      expect(translation.items?.length ?? 0).toBe(section.items?.length ?? 0);
      for (const text of [...(translation.paragraphs ?? []), ...(translation.items ?? [])]) {
        expect(text).toMatch(/[\u0600-\u06ff]/);
      }
    }
    for (const locale of ['en', 'ar'] as const) {
      const text = JSON.stringify(legalCopy[page][locale]);
      expect(text).toContain(LEGAL_CONTACT_EMAIL);
      expect(text).not.toMatch(/DRAFT|Open Question|Placeholder|to be set|\u2014/);
    }
  });

  it('keeps the approved privacy commitments and unverified safeguards explicit', () => {
    const text = JSON.stringify(legalCopy.privacy.en);
    expect(text).toContain('12 months after the conversation’s last activity');
    expect(text).toContain('within 30 days of receipt');
    expect(text).toContain('21 days without completion');
    expect(text).toContain('we act as the controller');
    expect(text).toContain('we act as a processor');
    expect(text).toContain('never altered by privacy deletion');
    expect(text).toContain('no other app’s installation');
    expect(text).toContain('not independently reviewed OpenRouter');
    expect(text).toContain('do not have signed Data Processing Agreements');
    expect(text).toContain('not completed a map of provider');
    expect(text).toContain('do not have an independent security certification');
    expect(text).toContain('12 months after creation');
    expect(text).toContain('after 30 days');
    expect(text).toContain('Reconnecting before deletion cancels');
    expect(text).toContain('Store Chat text replies');
    expect(text).toContain('fallback Store Chat');
    expect(text).toContain('Gmail SMTP by default');
    expect(text).toContain('Cloudflare Turnstile');
    expect(text).toContain('We do not store the upload on our own servers');
    expect(text).toContain('not a guarantee of zero provider retention');
  });

  it('does not invent commercial commitments or retain obsolete shared permissions', () => {
    const text = JSON.stringify(legalCopy.terms.en);
    expect(text).toContain('owner, admin, and member roles');
    expect(text).toContain('laws of Egypt');
    expect(text).toContain('do not set a contractual monetary cap');
    expect(text).toContain('do not establish a fixed contract duration');
    expect(text).not.toMatch(/365-day|same-day activation|same dashboard permissions/);
  });
});
