import React from 'react';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
// The preview is the real widget (preview-frame's own tests); here only that it draws the draft.
vi.mock('@/components/dashboard/messenger/preview-frame', () => ({
  PreviewFrame: ({ payload }: { payload: { appearance: { launcherIcon: string } } }) => (
    <div data-testid="preview">{payload.appearance.launcherIcon}</div>
  ),
}));

import { renderWithMantine } from '@/components/mantine/test-utils';
import { resolveMessengerConfig } from '@/lib/messenger/config';
import type { PublicMessengerPayload } from '@/lib/messenger/public-api';
import { getChatStudioCopy } from '@/lib/dashboard/chat-studio-copy';
import { V16ChatStudio, type ChatStudioActions, type ChatStudioMeta } from './v16-chat-studio';

const en = getChatStudioCopy('en');
const PUBLISHED = resolveMessengerConfig({});
const PAYLOAD = { active: true, aiEnabled: true, attachmentsEnabled: false, appearance: PUBLISHED.appearance, behaviour: { ...PUBLISHED.behaviour } } as unknown as PublicMessengerPayload;
const META: ChatStudioMeta = {
  domain: 'maison-noor.myshopify.com',
  embedKey: 'emb_test',
  active: true,
  version: 14,
  canRevert: true,
  canDisconnect: true,
  ordersAuthorized: true,
  lastSeenMinutes: 2,
  handoffRules: false,
};

function actions(): ChatStudioActions {
  return {
    saveDraftSections: vi.fn(async () => ({ ok: true as const })),
    publishConfig: vi.fn(async () => ({ ok: true as const })),
    revertConfigAction: vi.fn(async () => ({ ok: true as const })),
    setMessengerEnabled: vi.fn(async () => ({ ok: true as const })),
    disconnectSiteAction: vi.fn(async () => ({ ok: true as const })),
    discardDraft: vi.fn(async () => ({ ok: true as const })),
  };
}

function draw(a = actions(), locale: 'en' | 'ar' = 'en', meta: Partial<ChatStudioMeta> = {}) {
  renderWithMantine(
    <V16ChatStudio locale={locale} siteId="site_1" published={PUBLISHED} config={PUBLISHED} payload={PAYLOAD} meta={{ ...META, ...meta }} actions={a} />,
  );
  return a;
}

describe('V16ChatStudio', () => {
  it('lays out the board’s cards on today’s settings', () => {
    draw();
    for (const name of [en.whereItAppears.label, en.look.label, en.welcome.label, en.assistant.label, en.person.label, en.photosOrders.label, en.alerted.label, en.hours, en.installation]) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getByRole('switch', { name: en.storeChatOn })).toBeChecked();
    expect(screen.getByText(en.orderAccess)).toBeInTheDocument();
    expect(screen.getByText('Last storefront check 2 min ago.')).toBeInTheDocument();
    expect(screen.getByText('Published version 14')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: en.openThemeEditor })).toHaveAttribute('href', expect.stringContaining('maison-noor.myshopify.com/admin/themes/current/editor'));
    expect(screen.getByText('Always open.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: en.changesLabel })).not.toBeInTheDocument();
  });

  it('saves each change to the draft, counts it, and shows it in the preview', async () => {
    const a = draw();
    fireEvent.click(screen.getByRole('radio', { name: en.icons.help }));
    expect(screen.getByTestId('preview')).toHaveTextContent('help');
    const bar = screen.getByRole('region', { name: en.changesLabel });
    expect(within(bar).getByRole('status')).toHaveTextContent('1 change not live yet');
    await waitFor(() => expect(a.saveDraftSections).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(vi.mocked(a.saveDraftSections).mock.calls[0][1]).toEqual([{ section: 'appearance', payload: expect.objectContaining({ launcherIcon: 'help' }) }]);
    expect(within(bar).getByText(en.changesSaved)).toBeInTheDocument();

    fireEvent.click(within(bar).getByRole('button', { name: en.reviewChanges }));
    const dialog = await screen.findByRole('dialog', { name: en.reviewChanges });
    const row = within(dialog).getByRole('row', { name: /Launcher icon/ });
    expect(row).toHaveTextContent('Chat');
    expect(row).toHaveTextContent('Help');
  });

  it('publishes after the last change is saved', async () => {
    const a = draw();
    fireEvent.click(screen.getByRole('switch', { name: en.firstHello }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.publish }));
    });
    expect(a.saveDraftSections).toHaveBeenCalledTimes(1);
    expect(a.publishConfig).toHaveBeenCalledWith('site_1');
    expect(vi.mocked(a.saveDraftSections).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(a.publishConfig).mock.invocationCallOrder[0]);
    expect(screen.getByRole('status')).toHaveTextContent(en.published);
    expect(screen.getByText('Published version 15')).toBeInTheDocument();
  });

  it('discards the draft back to the published version', async () => {
    const a = draw();
    fireEvent.click(screen.getByRole('radio', { name: en.radii.sharp }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.discard }));
    });
    expect(a.discardDraft).toHaveBeenCalledWith('site_1');
    expect(screen.queryByRole('region', { name: en.changesLabel })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: en.radii.soft })).toBeChecked();
  });

  it('adds pages to hide on and alert addresses, and refuses a partial address', () => {
    draw();
    const pages = screen.getByRole('textbox', { name: en.hidePages.label });
    fireEvent.change(pages, { target: { value: '/Pages/Wholesale' } });
    fireEvent.keyDown(pages, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Remove /pages/wholesale' }));
    // The removed entry takes its button with it; focus goes back to the field.
    expect(pages).toHaveFocus();
    fireEvent.change(pages, { target: { value: '/pages/wholesale' } });
    fireEvent.keyDown(pages, { key: 'Enter' });
    expect(screen.getByRole('button', { name: 'Remove /pages/wholesale' })).toBeInTheDocument();

    const emails = screen.getByRole('textbox', { name: en.alertEmails });
    fireEvent.change(emails, { target: { value: 'hana@' } });
    fireEvent.click(within(emails.closest('div[class*="addRow"]') as HTMLElement).getByRole('button', { name: en.add }));
    expect(screen.getByText(en.badEmail)).toBeInTheDocument();
    fireEvent.change(emails, { target: { value: 'hana@maisonnoor.com' } });
    fireEvent.keyDown(emails, { key: 'Enter' });
    expect(screen.getByRole('button', { name: 'Remove hana@maisonnoor.com' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('2 changes not live yet');
  });

  it('takes a brand colour typed by hand once it is whole', () => {
    draw();
    const colour = screen.getByRole('textbox', { name: en.brandColour.label });
    fireEvent.change(colour, { target: { value: '#12' } });
    expect(colour).toHaveValue('#12');
    expect(screen.queryByRole('region', { name: en.changesLabel })).not.toBeInTheDocument();
    fireEvent.change(colour, { target: { value: '#123456' } });
    expect(screen.getByRole('status')).toHaveTextContent('1 change not live yet');
  });

  it('turns Store Chat off, and back when that fails', async () => {
    const a = actions();
    vi.mocked(a.setMessengerEnabled).mockResolvedValueOnce({ ok: false, error: 'nope' });
    draw(a);
    await act(async () => {
      fireEvent.click(screen.getByRole('switch', { name: en.storeChatOn }));
    });
    expect(a.setMessengerEnabled).toHaveBeenCalledWith('site_1', false);
    expect(screen.getByRole('switch', { name: en.storeChatOn })).toBeChecked();
    expect(screen.getByRole('alert')).toHaveTextContent(en.failed);
  });

  it('asks before disconnecting, and shows the extra handoff rules only with n25', async () => {
    const a = draw(undefined, 'en', { handoffRules: true });
    expect(screen.getByRole('switch', { name: en.ruleUpset })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: en.disconnect.label }));
    const dialog = await screen.findByRole('dialog', { name: en.disconnect.label });
    expect(dialog).toHaveTextContent(en.disconnectConfirm);
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: en.disconnect.label }));
    });
    expect(a.disconnectSiteAction).toHaveBeenCalledWith('site_1');
    expect(router.replace).toHaveBeenCalledWith('/dashboard/store-chat');
  });

  it('speaks Arabic in Arabic', () => {
    draw(undefined, 'ar');
    const ar = getChatStudioCopy('ar');
    expect(screen.getByRole('heading', { level: 2, name: ar.look.label })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: ar.storeChatOn })).toBeChecked();
    expect(screen.getByText('آخر فحص لواجهة المتجر قبل دقيقتين.')).toBeInTheDocument();
  });
});
