import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { AiKnowledgeEditor } from './ai-knowledge-editor';
import type { KnowledgeEntry } from '@/lib/messenger/knowledge';
import type { MessengerAi } from '@/lib/messenger/types';
import type { PublicMessengerPayload } from '@/lib/messenger/public-api';

const NOW = Date.parse('2026-09-10T12:00:00.000Z');
const daysAgoIso = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

const AI: MessengerAi = {
  enabled: true,
  tone: 'friendly',
  instructions: '',
  languageMode: 'auto',
  arabicDialect: 'egyptian' as const,
  escalationEnabled: true,
  handoffRules: {
    orderChanges: true,
    upset: true,
    bigOrder: { enabled: true, amountMinor: 1_000_000, currency: 'EGP', piecesOfOne: 5 },
  },
};

const PAYLOAD: PublicMessengerPayload = {
  v: 1,
  key: 'gc_test_key',
  storeName: "Sara's Store",
  active: true,
  available: true,
  aiEnabled: true,
  attachmentsEnabled: false,
  features: [],
  appearance: {
    accentColor: '#2a2826',
    launcherIcon: 'chat',
    launcherCustomIconUrl: null,
    launcherLabel: { en: 'Support', ar: 'الدعم' },
    launcherSizePx: 56,
    languageMode: 'auto',
    position: 'bottom-right',
    radiusStyle: 'soft',
    themeMode: 'light',
    assistantAvatarUrl: null,
  },
  behaviour: {
    welcomeTitle: { en: 'Hi', ar: 'مرحباً' },
    welcomeSubtitle: { en: 'Ask us', ar: 'اسألنا' },
    inputPlaceholder: { en: 'Ask anything…', ar: 'اكتب سؤالك…' },
    greetingEnabled: false,
    greetingDelaySeconds: 0,
    greeting: null,
    proactiveEnabled: false,
    proactiveDelaySeconds: 30,
    targetingMode: 'everywhere',
    excludePatterns: [],
  },
};

const actions = {
  saveDraftSection: vi.fn(),
  addKnowledge: vi.fn(),
  updateKnowledgeStatus: vi.fn(),
  deleteKnowledge: vi.fn(),
  syncKnowledge: vi.fn(),
};

function urlEntry(overrides: Partial<KnowledgeEntry> = {}): KnowledgeEntry {
  return {
    id: 'entry-url-1',
    title: 'Shipping policy',
    content: 'We ship from Riyadh in 1–3 days.',
    source: 'url',
    source_url: 'https://example.com/pages/shipping',
    status: 'active',
    last_synced_at: daysAgoIso(5),
    updated_at: daysAgoIso(5),
    ...overrides,
  };
}

function textEntry(overrides: Partial<KnowledgeEntry> = {}): KnowledgeEntry {
  return {
    id: 'entry-text-1',
    title: 'Returns note',
    content: 'Free returns within 14 days.',
    source: 'manual' as const,
    source_url: null,
    status: 'active',
    last_synced_at: null,
    updated_at: daysAgoIso(3),
    ...overrides,
  } as KnowledgeEntry;
}

function renderEditor(knowledge: KnowledgeEntry[]) {
  return render(
    <AiKnowledgeEditor
      locale="en"
      siteId="site-1"
      ai={AI}
      knowledge={knowledge}
      publishedPayload={PAYLOAD}
      actions={actions}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AiKnowledgeEditor sync freshness', () => {
  it('shows a neutral synced line with no stale flag for a recently synced url entry', () => {
    renderEditor([urlEntry()]);

    expect(screen.getByText('Synced 5d ago')).toBeInTheDocument();
    expect(screen.queryByText(/Stale/)).not.toBeInTheDocument();
  });

  it('flags a url entry synced more than 30 days ago as stale', () => {
    renderEditor([urlEntry({ id: 'entry-url-old', last_synced_at: daysAgoIso(40) })]);

    expect(screen.getByText('Stale · synced 40d ago')).toBeInTheDocument();
    expect(screen.queryByText('Synced 40d ago')).not.toBeInTheDocument();
  });

  it('flags a url entry that has never synced as stale', () => {
    renderEditor([urlEntry({ id: 'entry-url-never', last_synced_at: null })]);

    expect(screen.getByText('Stale · never synced')).toBeInTheDocument();
  });

  it('shows a neutral updated line for a text entry and never flags it stale, however old', () => {
    renderEditor([textEntry({ updated_at: daysAgoIso(100) })]);

    expect(screen.getByText('Updated 100d ago')).toBeInTheDocument();
    expect(screen.queryByText(/Stale/)).not.toBeInTheDocument();
  });
});

/* N25: the store's other handoff rules, behind n25_handoff_rules. */
describe('AiKnowledgeEditor handoff rules', () => {
  function renderWithRules(features: string[], locale: 'en' | 'ar' = 'en', ai: MessengerAi = AI) {
    return render(
      <AiKnowledgeEditor
        locale={locale}
        siteId="site-1"
        ai={ai}
        knowledge={[]}
        publishedPayload={{ ...PAYLOAD, features }}
        actions={actions}
      />,
    );
  }

  it('stays hidden while the store\'s flag is off', () => {
    renderWithRules([]);
    expect(screen.queryByText('When to bring in a person')).not.toBeInTheDocument();
  });

  it('shows the three rules with the store\'s big-order line, in English and Arabic', () => {
    const { unmount } = renderWithRules(['n25_handoff_rules']);
    expect(screen.getByText('When to bring in a person')).toBeInTheDocument();
    expect(screen.getByLabelText(/Requests to refund, exchange or change an order/)).toBeChecked();
    expect(screen.getByText('It still answers questions about your policies, like how long exchanges take.')).toBeInTheDocument();
    expect(screen.getByLabelText(/The shopper seems upset/)).toBeChecked();
    expect(screen.getByText('Over EGP 10,000, or 5 or more of one piece')).toBeInTheDocument();
    unmount();

    renderWithRules(['n25_handoff_rules'], 'ar');
    expect(screen.getByText('متى يتدخل شخص من الفريق')).toBeInTheDocument();
    expect(screen.getByText('أكثر من 10,000 ج.م، أو 5 قطع أو أكثر من الصنف نفسه')).toBeInTheDocument();
  });

  it('saves a rule turned off with the rest of the assistant settings', async () => {
    actions.saveDraftSection.mockResolvedValue({ ok: true });
    renderWithRules(['n25_handoff_rules']);
    fireEvent.click(screen.getByLabelText(/Big orders/));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    });
    expect(actions.saveDraftSection).toHaveBeenCalledWith(
      'site-1',
      'ai',
      expect.objectContaining({
        handoffRules: { orderChanges: true, upset: true, bigOrder: { enabled: false, amountMinor: 1_000_000, currency: 'EGP', piecesOfOne: 5 } },
      }),
    );
  });

  it('cannot be changed while offering a person is off', () => {
    renderWithRules(['n25_handoff_rules'], 'en', { ...AI, escalationEnabled: false });
    expect(screen.getByLabelText(/The shopper seems upset/)).toBeDisabled();
  });
});
