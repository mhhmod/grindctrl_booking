import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import {
  DashboardSquare01Icon,
  Download01Icon,
  Globe02Icon,
  MagicWand01Icon,
  Palette,
  UserGroupIcon,
} from '@hugeicons/core-free-icons';
import { Icon } from '@/components/icons';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const nav = [
  { href: '/dashboard/overview', label: 'Overview', icon: DashboardSquare01Icon },
  { href: '/dashboard/install', label: 'Install Widget', icon: Download01Icon },
  { href: '/dashboard/branding', label: 'Branding', icon: Palette },
  { href: '/dashboard/intents', label: 'Intents', icon: MagicWand01Icon },
  { href: '/dashboard/domains', label: 'Domains', icon: Globe02Icon },
  { href: '/dashboard/leads', label: 'Leads', icon: UserGroupIcon },
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
    <SidebarProvider defaultOpen>
      <Sidebar>
        <SidebarHeader className="px-3 py-3">
          <Link href="/" className="flex items-center gap-3 rounded-lg px-2 py-2 text-sidebar-foreground">
            <span className="grid size-9 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-sm font-semibold">
              G
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold leading-5">GRINDCTRL</div>
              <div className="truncate text-xs text-muted-foreground">Dashboard</div>
            </div>
          </Link>
        </SidebarHeader>

        <Separator />

        <SidebarContent className="px-2 py-3">
          <SidebarMenu>
            {nav.map((item) => {
              const active = currentPath === item.href;

              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                    <Link href={item.href}>
                      <Icon icon={item.icon} data-icon="inline-start" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        <Separator />

        <SidebarFooter className="px-3 py-3">
          <div className="rounded-lg border bg-card px-3 py-3">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Signed in</div>
            <div className="mt-2 break-all text-sm text-card-foreground">{userEmail}</div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Clerk session</span>
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
          <header className="flex flex-col gap-4">
            <div className="flex items-start gap-3 sm:items-center">
              <SidebarTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden">
                  <span className="sr-only">Open navigation</span>
                </Button>
              </SidebarTrigger>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
              </div>
            </div>
            <Separator />
          </header>

          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
