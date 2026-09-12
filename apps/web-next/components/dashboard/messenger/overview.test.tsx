import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessengerOverview } from './overview';

/* What this screen owes a merchant is a straight answer and a way to act on
   it. The publish control that used to live here has moved to PublishBar —
   see publish-bar.test.tsx. */

type Props = React.ComponentProps<typeof MessengerOverview>;

function renderOverview(overrides: Partial<Props> = {}) {
  const props: Props = {
    locale: 'en',
    siteId: 'site-1',
    siteName: 'Demo store',
    domain: 'demo.myshopify.com',
    active: true,
    aiEnabled: false,
    detectedAt: null,
    version: 3,
    stats: null,
    ...overrides,
  };
  return render(<MessengerOverview {...props} />);
}

describe('MessengerOverview status', () => {
  it('names the actual store rather than talking about a "storefront"', () => {
    renderOverview();
    expect(screen.getByText(/demo\.myshopify\.com/)).toBeInTheDocument();
    expect(screen.queryByText(/storefront/i)).not.toBeInTheDocument();
  });

  it('tells a set-up-but-unseen store what the remaining step is', () => {
    renderOverview({ active: true, detectedAt: null });
    expect(screen.getByRole('heading', { name: 'One step left' })).toBeInTheDocument();
  });

  it('confirms a live store and says when it was last seen', () => {
    renderOverview({ active: true, detectedAt: '2026-09-01T10:00:00.000Z' });
    expect(screen.getByRole('heading', { name: 'Store Chat is live' })).toBeInTheDocument();
    expect(screen.getByText(/Last seen on your store/)).toBeInTheDocument();
  });

  it('reports an off site as off, not as merely undetected', () => {
    renderOverview({ active: false, detectedAt: null });
    expect(screen.getByRole('heading', { name: 'Store Chat is turned off' })).toBeInTheDocument();
  });

  it('falls back to the site name when no domain is connected yet', () => {
    renderOverview({ domain: null });
    expect(screen.getByText(/Demo store/)).toBeInTheDocument();
  });
});

describe('MessengerOverview shortcuts', () => {
  it('sends an unfinished install straight to the Installation tab', () => {
    const onOpenTab = vi.fn();
    renderOverview({ active: true, detectedAt: null, onOpenTab });

    fireEvent.click(screen.getByRole('button', { name: 'Show me how' }));
    expect(onOpenTab).toHaveBeenCalledWith('installation');
  });

  /* "Off" is the state a merchant is most likely to be stuck in and least
     likely to connect to a specific tab, so it gets a button too. */
  it('offers a way out of the AI-is-off dead end', () => {
    const onOpenTab = vi.fn();
    renderOverview({ aiEnabled: false, onOpenTab });

    fireEvent.click(screen.getByRole('button', { name: 'Turn on AI replies' }));
    expect(onOpenTab).toHaveBeenCalledWith('ai');
  });

  it('offers no AI shortcut once AI is already on', () => {
    renderOverview({ aiEnabled: true, onOpenTab: vi.fn() });
    expect(screen.queryByRole('button', { name: 'Turn on AI replies' })).not.toBeInTheDocument();
  });
});

describe('MessengerOverview satisfaction', () => {
  it('renders the rounded CSAT percentage when feedback exists', () => {
    renderOverview({
      stats: {
        conversations7d: 10,
        aiResolved7d: 5,
        handedOff7d: 2,
        openNow: 1,
        medianFirstResponseSeconds7d: 12,
        feedbackUp30d: 11,
        feedbackDown30d: 1,
      },
    });
    expect(screen.getByText('Satisfaction · 30 days')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
  });

  it('shows no broken or misleading value when there is no feedback yet', () => {
    renderOverview({
      stats: {
        conversations7d: 10,
        aiResolved7d: 5,
        handedOff7d: 2,
        openNow: 1,
        medianFirstResponseSeconds7d: 12,
        feedbackUp30d: 0,
        feedbackDown30d: 0,
      },
    });
    expect(screen.getByText('Satisfaction · 30 days')).toBeInTheDocument();
    expect(screen.queryByText(/NaN%/)).not.toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});


afterEach(() => vi.restoreAllMocks());

describe('MessengerOverview revert', () => {
  const label = 'Revert to previous version';
  const success = 'Reverted — your store is serving the previous version again.';

  it.each([{ canRevert: false, actions: { revertConfigAction: vi.fn() } }, { canRevert: true }, { canRevert: true, siteId: undefined, actions: { revertConfigAction: vi.fn() } }])('hides revert without a snapshot, action, or site id: %j', (props) => {
    renderOverview(props);
    expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
  });

  it('requires confirmation, shows pending, leaves AI actionable, then hides revert on success', async () => {
    let finish!: (result: { ok: true }) => void;
    const revertConfigAction = vi.fn(() => new Promise<{ ok: true }>((resolve) => { finish = resolve; }));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onOpenTab = vi.fn();
    renderOverview({ canRevert: true, actions: { revertConfigAction }, onOpenTab });
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(confirm).toHaveBeenCalledWith('Restore the previous published version? This cannot be undone.');
    expect(revertConfigAction).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(revertConfigAction).toHaveBeenCalledExactlyOnceWith('site-1');
    expect(screen.getByRole('button', { name: 'Reverting…' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Turn on AI replies' }));
    expect(onOpenTab).toHaveBeenCalledExactlyOnceWith('ai');
    await act(async () => finish({ ok: true }));
    expect(screen.getByRole('status')).toHaveTextContent(success);
    expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
  });

  it('shows the server failure and allows retry', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const revertConfigAction = vi.fn().mockResolvedValue({ ok: false, error: 'Someone else published. Refresh.' });
    renderOverview({ canRevert: true, actions: { revertConfigAction } });
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Someone else published. Refresh.');
    expect(await screen.findByRole('button', { name: label })).toBeEnabled();
  });

  it('uses a generic failure for a rejected transport', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderOverview({ canRevert: true, actions: { revertConfigAction: vi.fn().mockRejectedValue(new Error('network internals')) } });
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not revert. Please try again.');
  });

  it('localizes confirmation and success in Arabic', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderOverview({ locale: 'ar', canRevert: true, actions: { revertConfigAction: vi.fn().mockResolvedValue({ ok: true, message: success }) } });
    fireEvent.click(screen.getByRole('button', { name: 'استعادة الإصدار السابق' }));
    expect(confirm).toHaveBeenCalledWith('هل تريد استعادة الإصدار المنشور السابق؟ لا يمكن التراجع عن هذه العملية.');
    expect(await screen.findByRole('status')).toHaveTextContent('تمت الاستعادة — متجرك يعرض الإصدار السابق مجدداً.');
  });
});


it('keeps success through revalidation but enables revert after the next publish', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const props: Props = {
    locale: 'en', siteId: 'site-1', siteName: 'Demo', domain: null,
    active: true, aiEnabled: true, detectedAt: null, version: 3, stats: null,
    canRevert: true, actions: { revertConfigAction: vi.fn().mockResolvedValue({ ok: true }) },
  };
  const { rerender } = render(<MessengerOverview {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Revert to previous version' }));
  await screen.findByRole('status');
  rerender(<MessengerOverview {...props} version={4} canRevert={false} />);
  expect(screen.getByRole('status')).toBeInTheDocument();
  rerender(<MessengerOverview {...props} version={5} canRevert />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Revert to previous version' })).toBeEnabled();
});


describe('MessengerOverview disconnect', () => {
  const label = 'Disconnect this store';
  const success = 'Store disconnected — your dashboard access has been removed. Nothing was deleted.';
  const confirmCopy = 'Disconnect this store from your grindctrl.cloud dashboard? This removes your dashboard access to this store. Store Chat keeps running in your Shopify admin exactly as before. Nothing is deleted: all conversations, knowledge, saved replies and settings stay with the store. You, or anyone with access to that Shopify admin, can reconnect it later through the normal claim flow and regain access to everything. If this was your only store, your dashboard may show a new, blank “My store” draft.';
  const actions = { revertConfigAction: vi.fn(), disconnectSiteAction: vi.fn() };

  it.each([
    { canDisconnect: false, actions },
    { canDisconnect: true, domain: null, actions },
    { canDisconnect: true, actions: { revertConfigAction: vi.fn() } },
    { canDisconnect: true, siteId: undefined, actions },
  ])('hides disconnect without eligibility, domain, action or site id: %j', (props) => {
    renderOverview(props);
    expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
  });

  it('requires confirmation, disables while pending, and hides the button on success', async () => {
    let finish!: (result: { ok: true }) => void;
    const disconnectSiteAction = vi.fn(() => new Promise<{ ok: true }>((resolve) => { finish = resolve; }));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderOverview({ canDisconnect: true, actions: { ...actions, disconnectSiteAction } });
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(confirm).toHaveBeenCalledWith(confirmCopy);
    expect(disconnectSiteAction).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(disconnectSiteAction).toHaveBeenCalledExactlyOnceWith('site-1');
    expect(screen.getByRole('button', { name: 'Disconnecting…' })).toBeDisabled();
    await act(async () => finish({ ok: true }));
    expect(screen.getByRole('status')).toHaveTextContent(success);
    expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
  });

  it.each(['server', 'transport', 'empty error'])('shows %s failure and allows retry', async (failure) => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const disconnectSiteAction = failure === 'transport'
      ? vi.fn().mockRejectedValue(new Error('private network detail'))
      : vi.fn().mockResolvedValue({ ok: false, error: failure === 'server' ? 'Refresh and try again.' : '' });
    renderOverview({ canDisconnect: true, actions: { ...actions, disconnectSiteAction } });
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(await screen.findByRole('alert')).toHaveTextContent(failure === 'server' ? 'Refresh and try again.' : 'Could not disconnect. Please try again.');
    expect(screen.getByRole('button', { name: label })).toBeEnabled();
  });

  it.each(['disconnect first', 'revert first'])('keeps pending and results independent when both actions overlap: %s', async (order) => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    let finishDisconnect!: (result: { ok: true }) => void;
    let finishRevert!: (result: { ok: false; error: string }) => void;
    const disconnectSiteAction = vi.fn(() => new Promise<{ ok: true }>((resolve) => { finishDisconnect = resolve; }));
    const revertConfigAction = vi.fn(() => new Promise<{ ok: false; error: string }>((resolve) => { finishRevert = resolve; }));
    renderOverview({ canDisconnect: true, canRevert: true, actions: { disconnectSiteAction, revertConfigAction } });
    const labels = order === 'disconnect first' ? [label, 'Revert to previous version'] : ['Revert to previous version', label];
    fireEvent.click(screen.getByRole('button', { name: labels[0] }));
    expect(screen.getByRole('button', { name: labels[1] })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: labels[1] }));
    expect(screen.getByRole('button', { name: 'Disconnecting…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reverting…' })).toBeDisabled();
    await act(async () => { finishDisconnect({ ok: true }); finishRevert({ ok: false, error: 'Revert failed independently.' }); });
    expect(screen.getByRole('status')).toHaveTextContent(success);
    expect(screen.getByRole('alert')).toHaveTextContent('Revert failed independently.');
    expect(screen.getByRole('button', { name: 'Revert to previous version' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
  });

  it('preserves the received success across stale props and resets on reconnect or another store', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const props: Props = {
      locale: 'en', siteId: 'site-1', siteName: 'Demo', domain: 'demo.myshopify.com',
      active: true, aiEnabled: true, detectedAt: null, version: 3, stats: null,
      canDisconnect: true, actions: { ...actions, disconnectSiteAction: vi.fn().mockResolvedValue({ ok: true }) },
    };
    const { rerender } = render(<MessengerOverview {...props} />);
    fireEvent.click(screen.getByRole('button', { name: label }));
    await screen.findByRole('status');
    rerender(<MessengerOverview {...props} version={4} />);
    expect(screen.getByRole('status')).toHaveTextContent(success);
    expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
    rerender(<MessengerOverview {...props} canDisconnect={false} />);
    rerender(<MessengerOverview {...props} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: label })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: label }));
    await screen.findByRole('status');
    rerender(<MessengerOverview {...props} siteId="site-2" />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: label })).toBeEnabled();
  });

  it('localizes the confirmation and outcome in Arabic', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderOverview({ locale: 'ar', canDisconnect: true, actions: { ...actions, disconnectSiteAction: vi.fn().mockResolvedValue({ ok: true }) } });
    fireEvent.click(screen.getByRole('button', { name: 'فصل هذا المتجر' }));
    expect(confirm).toHaveBeenCalledWith('هل تريد فصل هذا المتجر عن لوحة تحكمك في grindctrl.cloud؟ سيُزال وصولك إلى هذا المتجر من لوحة التحكم. ستستمر دردشة المتجر في العمل داخل لوحة إدارة Shopify كما كانت تماماً. لن يُحذف أي شيء: ستبقى جميع المحادثات والمعرفة والردود المحفوظة والإعدادات مرتبطة بالمتجر. يمكنك أنت، أو أي شخص لديه وصول إلى لوحة إدارة Shopify لهذا المتجر، إعادة ربطه لاحقاً عبر خطوات المطالبة المعتادة واستعادة الوصول إلى كل شيء. إذا كان هذا متجرك الوحيد، فقد تعرض لوحة تحكمك مسودة جديدة وفارغة باسم «متجري».');
    expect(await screen.findByRole('status')).toHaveTextContent('تم فصل المتجر — أُزيل وصولك إليه من لوحة التحكم. لم يُحذف أي شيء.');
  });
});
