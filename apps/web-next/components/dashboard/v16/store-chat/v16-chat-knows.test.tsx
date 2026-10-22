import React from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithMantine } from '@/components/mantine/test-utils';
import { getChatKnowsCopy } from '@/lib/dashboard/chat-knows-copy';
import { buildChatHead, buildPagesAndNotes } from '@/lib/dashboard/chat-knows-model';
import type { KnowledgeEntry } from '@/lib/messenger/knowledge';
import { V16ChatKnows, V16ChatKnowsError, type KnowledgeActions } from './v16-chat-knows';

const NOW = Date.parse('2026-10-22T12:00:00Z');
const SITE = '11111111-1111-4111-8111-111111111111';
const entry = (id: string, over: Partial<KnowledgeEntry> = {}): KnowledgeEntry => ({
  id,
  title: `Entry ${id}`,
  content: 'Facts.',
  source: 'manual',
  source_url: null,
  status: 'active',
  last_synced_at: null,
  updated_at: new Date(NOW).toISOString(),
  ...over,
});

const actions = {
  addKnowledge: vi.fn(),
  updateKnowledgeStatus: vi.fn(),
  deleteKnowledge: vi.fn(),
  syncKnowledge: vi.fn(),
} satisfies Record<keyof KnowledgeActions, ReturnType<typeof vi.fn>>;

function draw(entries: KnowledgeEntry[], locale: 'en' | 'ar' = 'en') {
  const copy = getChatKnowsCopy(locale);
  return renderWithMantine(
    <V16ChatKnows
      locale={locale}
      head={buildChatHead({ active: true, domain: 'maisonnoor.com', solved7: 120, handedOff7: 20 }, copy)}
      pages={buildPagesAndNotes(entries, copy, NOW)}
      siteId={SITE}
      actions={actions as unknown as KnowledgeActions}
    />,
  );
}

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockReset().mockResolvedValue({ ok: true });
});

describe('the v16 Store Chat page, What it knows', () => {
  it('has the live badge, the 7-day line, the store link and the two tabs', () => {
    draw([]);
    expect(screen.getByText('Live on maisonnoor.com')).toBeInTheDocument();
    expect(screen.getByText('In the last 7 days the assistant answered 86% of 140 chats on its own.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open your store' })).toHaveAttribute('href', 'https://maisonnoor.com');
    const tabs = screen.getByRole('navigation', { name: 'Store Chat' });
    expect(within(tabs).getByRole('link', { name: 'What it knows' })).toHaveAttribute('aria-current', 'page');
    expect(within(tabs).getByRole('link', { name: 'Set up' })).toHaveAttribute('href', '/dashboard/store-chat/setup');
    expect(screen.getByText(getChatKnowsCopy('en').pagesAndNotesNone)).toBeInTheDocument();
  });

  it('adds a note, then a page by link, through today’s knowledge action', async () => {
    draw([]);
    fireEvent.click(screen.getByRole('button', { name: 'Add a page or note' }));
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: 'Fabric care' } });
    fireEvent.change(screen.getByLabelText(/^What the assistant should know/), { target: { value: 'Hand wash cold.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(actions.addKnowledge).toHaveBeenCalledTimes(1));
    const note = actions.addKnowledge.mock.calls[0][0] as FormData;
    expect([note.get('siteId'), note.get('title'), note.get('content'), note.get('url')]).toEqual([SITE, 'Fabric care', 'Hand wash cold.', null]);
    // The status line is always there, empty until something happens.
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Added. The assistant uses it from the next chat.'));

    actions.addKnowledge.mockResolvedValue({ ok: false, error: 'Could not fetch page' });
    fireEvent.click(screen.getByRole('button', { name: 'Add a page or note' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Page' }));
    fireEvent.change(screen.getByLabelText(/^Page link/), { target: { value: 'https://maisonnoor.com/pages/faq' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(actions.addKnowledge).toHaveBeenCalledTimes(2));
    expect((actions.addKnowledge.mock.calls[1][0] as FormData).get('url')).toBe('https://maisonnoor.com/pages/faq');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent("Couldn't read that page."));
    expect(screen.getByLabelText(/^Page link/)).toHaveValue('https://maisonnoor.com/pages/faq');
  });

  it('pauses, re-syncs a page, and deletes only after asking', async () => {
    draw([entry('n1'), entry('p1', { source: 'url', source_url: 'https://maisonnoor.com/pages/faq', title: 'FAQ' })]);
    const [note, page] = screen.getAllByRole('listitem');
    expect(within(note).queryByRole('button', { name: 'Re-sync' })).not.toBeInTheDocument();

    // A row's buttons wait while its action runs, so each step waits for them.
    const ready = (row: HTMLElement, name: string) =>
      waitFor(() => expect(within(row).getByRole('button', { name })).toBeEnabled());

    fireEvent.click(within(note).getByRole('button', { name: 'Pause' }));
    await waitFor(() => expect(actions.updateKnowledgeStatus).toHaveBeenCalledWith(SITE, 'n1', 'disabled'));

    await ready(page, 'Re-sync');
    fireEvent.click(within(page).getByRole('button', { name: 'Re-sync' }));
    await waitFor(() => expect(actions.syncKnowledge).toHaveBeenCalledWith(SITE, 'p1'));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Re-synced.'));

    await ready(page, 'Delete');
    fireEvent.click(within(page).getByRole('button', { name: 'Delete' }));
    expect(actions.deleteKnowledge).not.toHaveBeenCalled();
    expect(within(page).getByText('Delete this? The assistant stops using it.')).toBeInTheDocument();
    fireEvent.click(within(page).getByRole('button', { name: 'Keep' }));
    fireEvent.click(within(page).getByRole('button', { name: 'Delete' }));
    fireEvent.click(within(page).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(actions.deleteKnowledge).toHaveBeenCalledWith(SITE, 'p1'));
  });

  it('shows five rows until asked for all, and says so when an action fails', async () => {
    actions.updateKnowledgeStatus.mockResolvedValue({ ok: false, error: 'down' });
    draw(Array.from({ length: 7 }, (_, i) => entry(`n${i}`)));
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Show all 7' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
    fireEvent.click(within(screen.getAllByRole('listitem')[6]).getByRole('button', { name: 'Pause' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent("That didn't go through. Try again in a minute."));
  });

  it('reads in Arabic, and says so when the knowledge could not load', () => {
    const { unmount } = draw([entry('n1', { title: 'العناية بالقماش' })], 'ar');
    expect(screen.getByRole('link', { name: 'ما يعرفه' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('تعمل على maisonnoor.com')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/[٠-٩]/);
    unmount();

    renderWithMantine(
      <V16ChatKnowsError locale="en" head={buildChatHead({ active: false, domain: null, solved7: null, handedOff7: null }, getChatKnowsCopy('en'))} />,
    );
    expect(screen.getByText("What the assistant knows couldn't load just now. Refresh in a minute.")).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open your store' })).not.toBeInTheDocument();
  });
});
