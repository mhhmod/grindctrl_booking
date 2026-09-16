import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlatformEvidenceSequence } from '@/components/landing/platform-evidence-sequence';
import { getLandingDictionary } from '@/lib/landing/landing-i18n';

vi.mock('@/components/landing/collaborations-marquee', () => ({
  CollaborationsMarquee: ({ labels }: { labels: Record<string, string> }) => (
    <div data-testid="integration-depth">{Object.values(labels).join(' · ')}</div>
  ),
}));

describe('PlatformEvidenceSequence', () => {
  it.each(['en', 'ar'] as const)('renders the five evidence stages in order for %s', (locale) => {
    const copy = getLandingDictionary(locale);
    render(
      <PlatformEvidenceSequence
        label={copy.platformEvidenceLabel}
        items={copy.platformEvidenceItems}
        integrationLabels={{
          implemented: copy.integrationStateImplemented,
          'setup-required': copy.integrationStateSetupRequired,
          'evidence-required': copy.integrationStateEvidenceRequired,
          planned: copy.integrationStatePlanned,
          infrastructure: copy.integrationStateInfrastructure,
        }}
      />,
    );

    const sequence = screen.getByRole('list', { name: copy.platformEvidenceLabel });
    const entries = within(sequence).getAllByRole('listitem');
    expect(entries).toHaveLength(5);
    copy.platformEvidenceItems.forEach((item, index) => {
      expect(within(entries[index]).getByRole('heading', { name: item.title })).toBeInTheDocument();
      expect(within(entries[index]).getByText(item.status)).toBeInTheDocument();
    });
    const integrationsEntry = entries.find((entry) => entry.querySelector('[data-testid="integration-depth"]'));
    expect(integrationsEntry).toBeDefined();
    expect(within(integrationsEntry!).getByTestId('integration-depth')).toHaveTextContent(copy.integrationStatePlanned);
  });

  it('uses the same stable item IDs and kinds in English and Arabic', () => {
    const englishItems = getLandingDictionary('en').platformEvidenceItems;
    const arabicItems = getLandingDictionary('ar').platformEvidenceItems;

    expect(arabicItems.map(({ id, kind }) => ({ id, kind }))).toEqual(
      englishItems.map(({ id, kind }) => ({ id, kind })),
    );
    expect(englishItems.filter((item) => item.kind === 'integrations')).toHaveLength(1);
  });
});
