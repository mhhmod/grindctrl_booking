import React from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithMantine as render } from '@/components/mantine/test-utils';
import { getShellCopy } from '@/lib/dashboard/shell-copy';
import type { ShellStore } from '@/lib/dashboard/shell-model';
import { resolveDashboardPermissions } from '@/lib/rbac/dashboard-policy';

let pathname = '/dashboard';
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ refresh, push: vi.fn() }),
}));
const clerk = { openUserProfile: vi.fn(), signOut: vi.fn() };
vi.mock('@clerk/nextjs', () => ({ useClerk: () => clerk }));
const setTheme = vi.fn();
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light', setTheme }) }));

import { V16Shell, isV16NavActive, type V16ShellProps } from './v16-shell';

const stores: ShellStore[] = [
  { key: 'shop:maison.myshopify.com', label: 'Maison Noor', domain: 'maison.myshopify.com', initials: 'MN', choice: { shop: 'maison.myshopify.com' }, current: true },
  { key: 'shop:kids.myshopify.com', label: 'kids', domain: 'kids.myshopify.com', initials: 'KI', choice: { shop: 'kids.myshopify.com' }, current: false },
];

function props(overrides: Partial<V16ShellProps> = {}): V16ShellProps {
  return {
    locale: 'en',
    stores,
    meter: { title: 'Looks this cycle', value: '150 left of 350', percent: 43, low: false },
    person: { name: 'Hana Adel', role: 'owner' },
    today: { date: 'Friday, 2 October', greeting: 'Good afternoon, Hana' },
    permissions: resolveDashboardPermissions({ role: 'owner' }),
    waitingCount: 0,
    children: <p>Page body</p>,
    ...overrides,
  };
}

beforeEach(() => {
  pathname = '/dashboard';
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => null })));
});

describe('V16Shell', () => {
  it('lists only the pages that exist, with the current one marked', () => {
    pathname = '/dashboard/try-on';
    render(<V16Shell {...props()} />);
    const nav = screen.getByRole('navigation', { name: 'GrindCTRL' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Today', 'Inbox', 'Try-On', 'Store Chat', 'Plan']);
    expect(within(nav).getByRole('link', { name: 'Try-On' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Today' })).not.toHaveAttribute('aria-current');
    // Settings waits for its page.
    expect(screen.queryByRole('link', { name: /Settings/ })).not.toBeInTheDocument();
  });

  /* The nav for each of the three roles (item 12). Plan is the owner's
     alone, as is the looks meter, which the layout passes only for the
     owner and which opens Plan; Settings is not built yet. */
  it.each([
    ['owner', true],
    ['admin', false],
    ['member', false],
  ] as const)('shows a %s their nav, and Plan and the meter only to the owner', (role, owner) => {
    render(
      <V16Shell
        {...props({
          permissions: resolveDashboardPermissions({ role }),
          person: { name: 'Nour Saleh', role },
          meter: owner ? props().meter : null,
        })}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'GrindCTRL' });
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(
      owner ? ['Today', 'Inbox', 'Try-On', 'Store Chat', 'Plan'] : ['Today', 'Inbox', 'Try-On', 'Store Chat'],
    );
    expect(within(screen.getByRole('navigation', { name: 'Main' })).queryByRole('link', { name: 'Plan' }) !== null).toBe(owner);
    expect(screen.queryByRole('link', { name: /Settings/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Looks this cycle') !== null).toBe(owner);
  });

  it('opens Plan from the meter for the owner, and keeps it a plain meter for anyone else', () => {
    const { unmount } = render(<V16Shell {...props()} />);
    expect(screen.getByTestId('looks-meter').tagName).toBe('A');
    expect(screen.getByTestId('looks-meter')).toHaveAttribute('href', '/dashboard/plan');
    unmount();
    // The layout passes the meter only to the owner; were it passed to an
    // admin, it would still not link to a page they may not open.
    render(<V16Shell {...props({ permissions: resolveDashboardPermissions({ role: 'admin' }) })} />);
    expect(screen.getByTestId('looks-meter').tagName).toBe('DIV');
  });

  it('lists no page the role may not see', () => {
    render(<V16Shell {...props({ permissions: resolveDashboardPermissions({ role: 'viewer' }) })} />);
    expect(within(screen.getByRole('navigation', { name: 'GrindCTRL' })).queryAllByRole('link')).toHaveLength(0);
  });

  it('greets on Today and titles every other page, with one h1', () => {
    render(<V16Shell {...props()} />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Good afternoon, Hana');
    expect(screen.getByText('Friday, 2 October')).toBeInTheDocument();
  });

  it('titles a page from the route table', () => {
    pathname = '/dashboard/store-chat';
    render(<V16Shell {...props()} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Store Chat');
    expect(screen.queryByText('Friday, 2 October')).not.toBeInTheDocument();
  });

  it('skips to the content', () => {
    render(<V16Shell {...props()} />);
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#v16-main');
    expect(document.getElementById('v16-main')?.tagName).toBe('MAIN');
  });

  it('switches store on the page the person is on', () => {
    pathname = '/dashboard/try-on';
    render(<V16Shell {...props()} />);
    const [switcher] = screen.getAllByRole('button', { name: 'Switch store, current Maison Noor' });
    fireEvent.click(switcher);
    const kids = screen.getByRole('menuitem', { name: /kids/ });
    expect(kids).toHaveAttribute('href', '/dashboard/try-on?shop=kids.myshopify.com');
    expect(screen.getByRole('menuitem', { name: /Maison Noor/ })).toHaveAttribute('aria-current', 'true');
  });

  it('shows the looks meter and the person, or leaves the meter out', () => {
    const { unmount } = render(<V16Shell {...props()} />);
    expect(screen.getByTestId('looks-meter')).toHaveTextContent('Looks this cycle150 left of 350');
    expect(screen.getByText('Hana Adel')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    unmount();
    render(<V16Shell {...props({ meter: null, person: { name: 'nour@example.com', role: null } })} />);
    expect(screen.queryByTestId('looks-meter')).not.toBeInTheDocument();
    expect(screen.queryByText('Owner')).not.toBeInTheDocument();
  });

  it('shows the waiting count on Inbox, in both navs', () => {
    render(<V16Shell {...props({ waitingCount: 3 })} />);
    expect(screen.getAllByLabelText('3 waiting for a person')).toHaveLength(2);
    const sidebar = screen.getByRole('navigation', { name: 'GrindCTRL' });
    expect(within(sidebar).getByRole('link', { name: /Inbox/ })).toHaveAttribute('href', '/dashboard/inbox');
    expect(within(within(sidebar).getByRole('link', { name: /Inbox/ })).getByLabelText('3 waiting for a person')).toBeInTheDocument();
    expect(within(within(sidebar).getByRole('link', { name: /Store Chat/ })).queryByLabelText('3 waiting for a person')).toBeNull();
  });

  it('offers the other language by its own name', () => {
    render(<V16Shell {...props()} />);
    const button = screen.getByRole('button', { name: getShellCopy('en').switchLanguage });
    expect(button).toHaveTextContent('العربية');
    fireEvent.click(button);
    expect(document.cookie).toContain('gc-locale=ar');
    expect(refresh).toHaveBeenCalled();
  });

  it('speaks Arabic in Arabic', () => {
    pathname = '/dashboard/try-on';
    render(<V16Shell {...props({ locale: 'ar', person: { name: 'هناء عادل', role: 'owner' } })} />);
    const nav = screen.getByRole('navigation', { name: 'GrindCTRL' });
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'اليوم',
      'الرسائل',
      'التجربة الافتراضية',
      'دردشة المتجر',
      'الباقة',
    ]);
    expect(screen.getByRole('navigation', { name: 'القائمة الرئيسية' })).toHaveTextContent('الدردشة');
    expect(screen.getByText('المالك')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch to English' })).toHaveTextContent('English');
  });
});

describe('isV16NavActive', () => {
  it('keeps Today to its own page', () => {
    expect(isV16NavActive('/dashboard', '/dashboard')).toBe(true);
    expect(isV16NavActive('/dashboard/try-on', '/dashboard')).toBe(false);
    expect(isV16NavActive('/dashboard/store-chat/x', '/dashboard/store-chat')).toBe(true);
  });
});
