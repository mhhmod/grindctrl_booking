import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  escalationEnabled: true,
};

const PAYLOAD: PublicMessengerPayload = {
  v: 1,
  key: 'gc_test_key',
  storeName: "Sara's Store",
  active: true,
  available: true,
  aiEnabled: true,
  attachmentsEnabled: false,
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
