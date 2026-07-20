import React from 'react';
import { notFound } from 'next/navigation';
import { DashboardSquare01Icon, MagicWand01Icon } from '@hugeicons/core-free-icons';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DashboardSidebarNav } from '@/components/dashboard/nav-link';
import { TryOnSettingsPanel } from '@/components/dashboard/tryon-settings-panel';
import { ShopPlanControl } from '@/components/dashboard/shop-plan-control';
import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { DEFAULT_SETTINGS } from '@/lib/try-on/settings';
import type { DashboardResolvedNavItem } from '@/lib/dashboard/nav-config';
import type {
  CreditPackCatalogItem,
  PlanCatalogItem,
  ShopEntitlement,
} from '@/lib/try-on/entitlement';

/* Dev-only mirror of the Try-On tab with mock data, so mobile layout can be
   verified in a browser without the Clerk wall. Not built for production use;
   hidden there outright. */

const PLANS: PlanCatalogItem[] = [
  { id: 'p0', planKey: 'free-v1', name: 'Free', description: null, priceMinor: 0, currency: 'USD', rendersIncluded: 20, modelKey: 'lite', periodUnit: 'month', periodCount: 1, graceDays: 0, isFree: true, active: true, sortOrder: 10 },
  { id: 'p1', planKey: 'launch-v1', name: 'Launch', description: null, priceMinor: 1500, currency: 'USD', rendersIncluded: 300, modelKey: 'lite', periodUnit: 'month', periodCount: 1, graceDays: 3, isFree: false, active: true, sortOrder: 20 },
];

const PACKS: CreditPackCatalogItem[] = [
  { id: 'k1', packKey: 'pack-lite-v1', name: 'Boost 80', priceMinor: 500, currency: 'USD', renders: 80, modelKey: 'lite', validityDays: 365, active: true, sortOrder: 10 },
];

const NAV_ITEMS: DashboardResolvedNavItem[] = [
  {
    href: '#overview',
    label: 'Overview',
    icon: DashboardSquare01Icon,
    permissionKey: 'canViewOverview',
    group: 'core',
    isActive: true,
  },
  {
    href: '#try-on',
    label: 'Try-On',
    icon: MagicWand01Icon,
    permissionKey: 'canViewAgents',
    group: 'core',
    isActive: false,
  },
];

const STATE: ShopEntitlement = {
  shop: 'grindctrl.myshopify.com',
  subscriptionId: 's1',
  planId: 'p0',
  planKey: 'free-v1',
  planName: 'Free',
  status: 'active',
  isFree: true,
  rendersIncluded: 20,
  planCreditsRemaining: 17,
  topUpCreditsRemaining: 0,
  totalCreditsRemaining: 17,
  currentPeriodStart: '2026-07-19T00:00:00.000Z',
  currentPeriodEnd: '2026-08-19T00:00:00.000Z',
  graceEndsAt: '2026-08-19T00:00:00.000Z',
  daysRemaining: 30,
  bannerState: 'none',
  available: true,
  pendingPlanKey: null,
  pendingPlanEffectiveAt: null,
  notes: null,
};

export default function UiCheckPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <SidebarProvider defaultOpen>
      <Sidebar>
        <SidebarContent className="p-2">
          <DashboardSidebarNav navItems={NAV_ITEMS} />
        </SidebarContent>
      </Sidebar>

      <SidebarInset className="min-w-0 bg-muted/40">
        <header className="flex h-14 items-center border-b px-4">
          <SidebarTrigger aria-label="Toggle dashboard navigation" />
        </header>
        <main className="min-w-0">
          <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-4 p-4">
            <section id="try-on" className="grid min-w-0 gap-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Installed shops', '1'],
              ['Recent generations', '20'],
              ['Avg generation time', '9.2s'],
              ['Provider spend (recent)', '$0.89'],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardHeader className="pb-2">
                  <CardDescription>{label}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-semibold text-foreground">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Merchant shops</CardTitle>
              <CardDescription>
                A shop appears the first time its admin opens the app.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shop</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-end">Generations</TableHead>
                    <TableHead>Last generation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">grindctrl.myshopify.com</TableCell>
                    <TableCell>
                      <Badge variant="secondary">installed</Badge>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">20</TableCell>
                    <TableCell className="text-muted-foreground">19/07/2026, 22:19</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Plan and credits</CardTitle>
              <CardDescription>Owner plan control with the real component.</CardDescription>
            </CardHeader>
            <CardContent>
              <ShopPlanControl
                shop="grindctrl.myshopify.com"
                state={STATE}
                plans={PLANS}
                packs={PACKS}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Appearance and journey</CardTitle>
              <CardDescription>The shared settings form with the live preview.</CardDescription>
            </CardHeader>
            <CardContent>
              <TryOnSettingsPanel
                shops={[{ domain: 'grindctrl.myshopify.com', status: 'installed', jobCount: 20 }]}
                selectedShop="default"
                settings={{ ...DEFAULT_SETTINGS }}
              />
            </CardContent>
          </Card>
            </section>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
