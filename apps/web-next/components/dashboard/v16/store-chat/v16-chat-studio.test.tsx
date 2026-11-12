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
import { pasteInstallCopy } from '@/lib/dashboard/paste-install-copy';
import { pasteRetentionDate } from '@/lib/dashboard/paste-retention-date';
import { V16ChatStudio, type ChatStudioActions, type ChatStudioMeta } from './v16-chat-studio';

// The whole board is rendered by every test, and it can exceed the default 5 s under parallel Windows load.
vi.setConfig({ testTimeout: 20000 });

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
  ordersGrant: null,
  shopTimezone: 'Africa/Cairo',
  lastSeenMinutes: 2,
  handoffRules: false,
  wooConnection: null,
};
const REPLIES = [
  { id: 'r1', title: 'Shipping times', content: 'Two to four days.', status: 'active' as const, sort_order: 0, updated_at: '2026-11-01T00:00:00Z' },
  { id: 'r2', title: 'Returns', content: 'Within 14 days.', status: 'disabled' as const, sort_order: 1, updated_at: '2026-11-01T00:00:00Z' },
];

function actions(): ChatStudioActions {
  return {
    saveDraftSections: vi.fn(async () => ({ ok: true as const })),
    publishConfig: vi.fn(async () => ({ ok: true as const })),
    revertConfigAction: vi.fn(async () => ({ ok: true as const })),
    setMessengerEnabled: vi.fn(async () => ({ ok: true as const })),
    disconnectSiteAction: vi.fn(async () => ({ ok: true as const })),
    discardDraft: vi.fn(async () => ({ ok: true as const })),
    uploadLauncherIconAction: vi.fn(async () => ({ ok: true as const, url: 'https://files.example/messenger-icons/site_1/abc.png' })),
    addCannedReply: vi.fn(async () => ({ ok: true as const })),
    updateCannedReplyStatus: vi.fn(async () => ({ ok: true as const })),
    deleteCannedReply: vi.fn(async () => ({ ok: true as const })),
    createWooPairingCodeAction: vi.fn(async () => ({
      ok: true as const,
      code: 'K7QM4TXP',
      expiresAt: '2026-11-04T10:15:00.000Z',
    })),
  };
}

function draw(a = actions(), locale: 'en' | 'ar' = 'en', meta: Partial<ChatStudioMeta> = {}) {
  renderWithMantine(
    <V16ChatStudio locale={locale} siteId="site_1" published={PUBLISHED} config={PUBLISHED} payload={PAYLOAD} cannedReplies={REPLIES} meta={{ ...META, ...meta }} actions={a} />,
  );
  return a;
}

describe('V16ChatStudio', () => {
  it.each(['en', 'ar'] as const)('keeps the disconnected deadline without a duplicate paste disconnect in %s', async locale => {
    const copy = getChatStudioCopy(locale);
    const retention = pasteInstallCopy(locale);
    const deadline = '2026-12-12T12:00:00Z';
    draw(actions(), locale, { active: false, pasteRetention: { disconnected: true, redactAfter: deadline } });
    expect(screen.getByText(retention.deletionDate(pasteRetentionDate(deadline, locale)!))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.disconnect.label })).not.toBeInTheDocument();
    expect(screen.queryByText(copy.disconnect.body)).not.toBeInTheDocument();
  }, 20000);
  // This full Mantine board can exceed the default timeout under parallel Windows load.
  it('lays out the board’s cards on today’s settings', () => {
    draw();
    for (const name of [en.whereItAppears.label, en.look.label, en.welcome.label, en.assistant.label, en.person.label, en.photosOrders.label, en.alerted.label, en.hours, en.installation]) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getByRole('switch', { name: en.storeChatOn })).toBeChecked();
    expect(screen.getByText(en.orderAccess)).toBeInTheDocument();
    expect(screen.getByText('Last storefront check 2 min ago.')).toBeInTheDocument();
    expect(screen.getByText('Published version 14')).toBeInTheDocument();
    expect(screen.getByText(en.installMoved)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: en.openStoreSetup })).toHaveAttribute('href', '/dashboard/store#connect');
    expect(screen.queryByRole('link', { name: en.openThemeEditor })).not.toBeInTheDocument();
    expect(screen.getByText('Always open.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: en.changesLabel })).not.toBeInTheDocument();
  }, 20000);

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
    expect(router.replace).toHaveBeenCalledWith(`/dashboard/store-chat?disconnected=1&shop=${encodeURIComponent(META.domain!)}`);
  });

  it('directs WooCommerce installation to Store setup', () => {
    draw(undefined, 'en', { domain: 'shop.example.com' });
    expect(screen.queryByRole('heading', { level: 3, name: en.woocommerce.title })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: en.openStoreSetup })).toHaveAttribute('href', '/dashboard/store#connect');
  });

  describe('order lookup on a connected WooCommerce store', () => {
    const connection = (pluginVersion: string, status: 'active' | 'disconnected' = 'active') => ({
      platform: 'woocommerce' as const,
      status,
      pluginVersion,
      lastSeenAt: '2026-11-04T09:00:00.000Z',
      pairedAt: '2026-11-03T09:00:00.000Z',
      homeUrl: 'https://shop.example.com/',
      cloneSuspected: false,
      pluginOutdated: false,
    });

    it('says it is ready from plugin 0.3.0, with no Shopify order grant wording', () => {
      draw(undefined, 'en', { domain: 'shop.example.com', ordersAuthorized: false, wooConnection: connection('0.3.0') });
      expect(screen.getByRole('switch', { name: en.orderLookup.label })).toBeInTheDocument();
      expect(screen.getByText(en.wooOrderReady)).toBeInTheDocument();
      expect(screen.queryByText(en.noOrderAccess)).not.toBeInTheDocument();
    });

    it('asks for the plugin update on an older plugin', () => {
      draw(undefined, 'en', { domain: 'shop.example.com', ordersAuthorized: false, wooConnection: connection('0.2.0') });
      expect(screen.getByText(en.wooOrderUpdate('0.3.0'))).toBeInTheDocument();
      expect(screen.queryByText(en.wooOrderReady)).not.toBeInTheDocument();
    });

    it('offers nothing before the store is connected', () => {
      draw(undefined, 'en', { domain: 'shop.example.com', ordersAuthorized: false, wooConnection: null });
      expect(screen.queryByRole('switch', { name: en.orderLookup.label })).not.toBeInTheDocument();
    });

    it('speaks Arabic', () => {
      draw(undefined, 'ar', { domain: 'shop.example.com', wooConnection: connection('0.3.0') });
      expect(screen.getByText(getChatStudioCopy('ar').wooOrderReady)).toBeInTheDocument();
    });
  });

  describe('what used to live on More settings', () => {
    it('has no link to the earlier screens any more', () => {
      draw();
      expect(document.body.innerHTML).not.toContain('setup/more');
      expect(screen.queryByText(/More settings/i)).not.toBeInTheDocument();
    });

    it('turns on the second reminder and its delay, through the draft', async () => {
      const a = draw();
      expect(screen.queryByRole('textbox', { name: en.reminderDelay })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('switch', { name: en.reminder.label }));
      fireEvent.change(await screen.findByLabelText(en.reminderDelay), { target: { value: '45' } });
      await waitFor(
        () => expect(vi.mocked(a.saveDraftSections).mock.calls.at(-1)![1][0].payload).toEqual(expect.objectContaining({ proactiveEnabled: true, proactiveDelaySeconds: 45 })),
        { timeout: 4000 },
      );
    });

    it('pins the chat language, and sizes the bubble', async () => {
      const a = draw();
      fireEvent.click(within(screen.getByRole('radiogroup', { name: en.widgetLanguage.label })).getByRole('radio', { name: en.widgetLanguages.ar }));
      await waitFor(() => expect(a.saveDraftSections).toHaveBeenCalled(), { timeout: 2000 });
      expect(vi.mocked(a.saveDraftSections).mock.calls.at(-1)![1][0].payload).toEqual(expect.objectContaining({ languageMode: 'ar' }));
      expect(screen.getByRole('slider', { name: en.launcherSize.label })).toBeInTheDocument();
    });

    it('edits opening hours in place: mode, days and their times', async () => {
      const a = draw();
      fireEvent.click(screen.getByRole('button', { name: en.hoursModes.hours }));
      // The store's own time zone replaces UTC.
      expect(screen.getByLabelText(en.timezone)).toHaveValue('Africa/Cairo');
      expect(screen.getByText(en.noDays)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('checkbox', { name: en.days[6] }));
      fireEvent.change(screen.getByLabelText(`${en.from}, ${en.days[6]}`), { target: { value: '10:30' } });
      await waitFor(
        () => {
          const behaviour = vi.mocked(a.saveDraftSections).mock.calls.at(-1)![1].find((s) => s.section === 'behaviour')!.payload;
          expect(behaviour).toEqual(expect.objectContaining({ availabilityMode: 'hours', availabilityTimezone: 'Africa/Cairo', availabilityHours: [{ day: 6, startMinute: 630, endMinute: 1020 }] }));
        },
        { timeout: 4000 },
      );
    });

    it('keeps saved replies saved as they are made, with what is on and off', async () => {
      const a = draw();
      const list = screen.getByRole('region', { name: en.savedReplies.label });
      expect(within(list).getByText('Shipping times')).toBeInTheDocument();
      const add = within(list).getByRole('button', { name: en.addReply });
      expect(add).toBeDisabled();
      fireEvent.change(within(list).getByLabelText(en.replyTitle), { target: { value: 'Sizing' } });
      fireEvent.change(within(list).getByLabelText(en.replyText), { target: { value: 'Runs small.' } });
      await act(async () => {
        fireEvent.click(add);
      });
      expect(a.addCannedReply).toHaveBeenCalledWith('site_1', 'Sizing', 'Runs small.');
      expect(within(list).getByText(en.replyAdded)).toBeInTheDocument();
      await act(async () => {
        fireEvent.click(within(list).getByRole('button', { name: en.replyTurnOn }));
      });
      expect(a.updateCannedReplyStatus).toHaveBeenCalledWith('site_1', 'r2', 'active');
      await act(async () => {
        fireEvent.click(within(list).getAllByRole('button', { name: en.replyDelete })[0]);
      });
      expect(a.deleteCannedReply).toHaveBeenCalledWith('site_1', 'r1');
    });

    it('says when a saved reply could not be added', async () => {
      const a = actions();
      vi.mocked(a.addCannedReply).mockResolvedValueOnce({ ok: false, error: 'x' });
      draw(a);
      const list = screen.getByRole('region', { name: en.savedReplies.label });
      fireEvent.change(within(list).getByLabelText(en.replyTitle), { target: { value: 'Sizing' } });
      fireEvent.change(within(list).getByLabelText(en.replyText), { target: { value: 'Runs small.' } });
      await act(async () => {
        fireEvent.click(within(list).getByRole('button', { name: en.addReply }));
      });
      expect(within(list).getByText(en.replyFailed)).toBeInTheDocument();
    });

    it('approves order access from here, and says how the approval ended', () => {
      draw(undefined, 'en', { ordersAuthorized: false, ordersGrant: 'failed' });
      expect(screen.getByRole('link', { name: en.orderGrant.connect })).toHaveAttribute('href', '/api/shopify/oauth/start?shop=maison-noor.myshopify.com');
      expect(screen.getByText(en.orderGrant.refused)).toBeInTheDocument();
    });
  });

  describe('the launcher icon upload', () => {
    const file = (type: string, size = 1000, name = 'icon.png') => new File([new Uint8Array(size)], name, { type });
    const pick = (f: File) => fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [f] } });

    it('replaces the address field: uploads, previews, saves the draft, and can be removed', async () => {
      const a = draw();
      expect(screen.queryByText(/Custom icon URL/i)).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/cdn\.yourstore\.com/)).not.toBeInTheDocument();
      await act(async () => {
        pick(file('image/png'));
      });
      const sent = vi.mocked(a.uploadLauncherIconAction).mock.calls[0][0];
      expect(sent.get('siteId')).toBe('site_1');
      expect((sent.get('icon') as File).name).toBe('icon.png');
      expect(screen.getByRole('img', { name: en.customIcon.alt })).toHaveAttribute('src', 'https://files.example/messenger-icons/site_1/abc.png');
      expect(screen.getByText(en.customIcon.inUse)).toBeInTheDocument();
      await waitFor(() => expect(a.saveDraftSections).toHaveBeenCalled(), { timeout: 2000 });
      expect(vi.mocked(a.saveDraftSections).mock.calls.at(-1)![1][0].payload).toEqual(
        expect.objectContaining({ launcherCustomIconUrl: 'https://files.example/messenger-icons/site_1/abc.png' }),
      );

      fireEvent.click(screen.getByRole('button', { name: en.customIcon.remove }));
      expect(screen.queryByRole('img', { name: en.customIcon.alt })).not.toBeInTheDocument();
    });

    it('turns a wrong file away before sending it, in words', async () => {
      const a = draw();
      await act(async () => {
        pick(file('image/png', 300 * 1024));
      });
      expect(screen.getByRole('alert')).toHaveTextContent(en.customIcon.errors.too_big);
      await act(async () => {
        pick(file('image/gif'));
      });
      expect(screen.getByRole('alert')).toHaveTextContent(en.customIcon.errors.bad_type);
      expect(a.uploadLauncherIconAction).not.toHaveBeenCalled();
    });

    it('says what the server found wrong with a file that looked right', async () => {
      const a = actions();
      vi.mocked(a.uploadLauncherIconAction).mockResolvedValueOnce({ ok: false, error: 'not_square' });
      draw(a);
      await act(async () => {
        pick(file('image/png'));
      });
      expect(screen.getByRole('alert')).toHaveTextContent(en.customIcon.errors.not_square);
      expect(screen.queryByRole('img', { name: en.customIcon.alt })).not.toBeInTheDocument();
    });

    it('keeps an icon address a store already has, showing it as its icon', () => {
      renderWithMantine(
        <V16ChatStudio
          locale="en"
          siteId="site_1"
          published={resolveMessengerConfig({ messenger_appearance: { launcherCustomIconUrl: 'https://cdn.old-store.com/icon.png' } })}
          config={resolveMessengerConfig({ messenger_appearance: { launcherCustomIconUrl: 'https://cdn.old-store.com/icon.png' } })}
          payload={PAYLOAD}
          cannedReplies={[]}
          meta={META}
          actions={actions()}
        />,
      );
      expect(screen.getByRole('img', { name: en.customIcon.alt })).toHaveAttribute('src', 'https://cdn.old-store.com/icon.png');
      expect(screen.getByRole('button', { name: en.customIcon.replace })).toBeInTheDocument();
    });
  });

  it('speaks Arabic in Arabic', () => {
    draw(undefined, 'ar');
    const ar = getChatStudioCopy('ar');
    expect(screen.getByRole('heading', { level: 2, name: ar.look.label })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: ar.storeChatOn })).toBeChecked();
    expect(screen.getByText('آخر فحص لواجهة المتجر قبل دقيقتين.')).toBeInTheDocument();
  });
});
