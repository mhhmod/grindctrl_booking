import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { LayoutDashboard, Palette, Download, Wand2, Globe, Users } from 'lucide-react';

const nav = [
  { href: '/dashboard/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/install', label: 'Install Widget', icon: Download },
  { href: '/dashboard/branding', label: 'Branding', icon: Palette },
  { href: '/dashboard/intents', label: 'Intents', icon: Wand2 },
  { href: '/dashboard/domains', label: 'Domains', icon: Globe },
  { href: '/dashboard/leads', label: 'Leads', icon: Users },
];

export function DashboardShell({
  currentPath,
  title,
  description,
  userEmail,
  children,
}: {
  currentPath: string;
  title: string;
  description: string;
  userEmail: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="border-b border-zinc-800 bg-zinc-950 px-4 py-5 lg:min-h-screen lg:border-b-0 lg:border-r lg:px-5">
        <Link href="/" className="flex items-center gap-3 rounded-xl px-2 py-2 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-semibold text-zinc-950">G</span>
          <div>
            <div className="text-sm font-semibold">GRINDCTRL</div>
            <div className="text-xs text-zinc-500">Dashboard</div>
          </div>
        </Link>

        <nav className="mt-6 grid gap-1">
          {nav.map((item) => {
            const active = currentPath === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                  active ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100',
                ].join(' ')}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">Signed in</div>
          <div className="mt-2 break-all text-sm text-zinc-200">{userEmail}</div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-zinc-500">Clerk session</span>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </aside>

      <main className="px-5 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8 flex flex-col gap-4 border-b border-zinc-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">{title}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">{description}</p>
            </div>
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}
