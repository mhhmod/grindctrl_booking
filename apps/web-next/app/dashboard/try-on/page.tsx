import React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { listRecentTryOnJobs } from '@/lib/try-on/persistence';
import { getTryOnSettings } from '@/lib/try-on/settings';
import { saveTryOnSettingsAction } from './actions';
import { WidgetPreview } from '@/components/try-on/widget-preview';

export const dynamic = 'force-dynamic';

/* Theme-editor deep link: opens the merchant's theme editor with the
   try-on app block pre-added to the product template. The block id is
   the Shopify app CLIENT ID + block filename (extension uid fails). */
const SHOPIFY_APP_CLIENT_ID = 'fc095fe656d9029fdc249a4af2315f19';
const DEEP_LINK = `https://grindctrl.myshopify.com/admin/themes/current/editor?template=product&addAppBlockId=${SHOPIFY_APP_CLIENT_ID}/tryon&target=mainSection`;

function statusTone(status: string) {
  if (status === 'completed') return 'secondary' as const;
  return 'destructive' as const;
}

export default async function DashboardTryOnPage() {
  const [jobs, settings] = await Promise.all([
    listRecentTryOnJobs(25),
    getTryOnSettings('default'),
  ]);

  const completed = jobs.filter((j) => j.status === 'completed');
  const totalCost = jobs.reduce((sum, j) => sum + (j.cost_usd ?? 0), 0);
  const avgSeconds = completed.length
    ? completed.reduce((sum, j) => sum + (j.duration_ms ?? 0), 0) / completed.length / 1000
    : 0;

  const kpis = [
    { label: 'Recent generations', value: String(jobs.length) },
    { label: 'Completed', value: String(completed.length) },
    { label: 'Avg generation time', value: completed.length ? `${avgSeconds.toFixed(1)}s` : '—' },
    { label: 'Provider spend (recent)', value: `$${totalCost.toFixed(2)}` },
  ];

  return (
    <section className="grid gap-6">
      <header className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Try-On Agent</h1>
        <p className="text-sm text-muted-foreground">
          Live AI try-on: journey styling, job history, and Shopify install.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardDescription>{kpi.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold text-foreground">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Journey settings</CardTitle>
            <CardDescription>
              Controls the try-on button and flow everywhere it appears: storefront blocks,
              the embed, and the public demo. Changes go live within a minute.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <WidgetPreview s={settings} />
            </div>
            <form action={saveTryOnSettingsAction} className="grid gap-4">
              <input type="hidden" name="shop" value="default" />
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="button_label">Button label</Label>
                  <Input
                    id="button_label"
                    name="button_label"
                    defaultValue={settings.buttonLabel}
                    maxLength={40}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="catalog_label">Catalog pill label</Label>
                  <Input
                    id="catalog_label"
                    name="catalog_label"
                    defaultValue={settings.catalogLabel}
                    maxLength={24}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="accent_bg">Button color</Label>
                  <Input
                    id="accent_bg"
                    name="accent_bg"
                    type="color"
                    defaultValue={settings.accentBg}
                    className="h-10 p-1"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="accent_fg">Button text color</Label>
                  <Input
                    id="accent_fg"
                    name="accent_fg"
                    type="color"
                    defaultValue={settings.accentFg}
                    className="h-10 p-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="radius_px">Corner radius (px)</Label>
                  <Input
                    id="radius_px"
                    name="radius_px"
                    type="number"
                    min={0}
                    max={999}
                    defaultValue={settings.radiusPx}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="widget_theme">Widget theme</Label>
                  <select
                    id="widget_theme"
                    name="widget_theme"
                    defaultValue={settings.widgetTheme}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="icon_bg_from">Icon gradient start</Label>
                  <Input
                    id="icon_bg_from"
                    name="icon_bg_from"
                    type="color"
                    defaultValue={settings.iconBgFrom}
                    className="h-10 p-1"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="icon_bg_to">Icon gradient end</Label>
                  <Input
                    id="icon_bg_to"
                    name="icon_bg_to"
                    type="color"
                    defaultValue={settings.iconBgTo}
                    className="h-10 p-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {([
                  ['button_icon_px', 'Button icon size', settings.buttonIconPx, 18, 40],
                  ['catalog_icon_px', 'Catalog icon size', settings.catalogIconPx, 10, 32],
                  ['catalog_font_px', 'Catalog label size', settings.catalogFontPx, 9, 20],
                  ['catalog_pad_px', 'Catalog pill padding', settings.catalogPadPx, 2, 16],
                ] as const).map(([name, label, value, min, max]) => (
                  <div key={name} className="grid gap-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <Label htmlFor={name} className="text-sm">{label}</Label>
                      <span className="tabular-nums text-xs text-muted-foreground">{value}px</span>
                    </div>
                    <input
                      id={name}
                      name={name}
                      type="range"
                      min={min}
                      max={max}
                      defaultValue={value}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-foreground"
                    />
                  </div>
                ))}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="loading_style">Loading animation</Label>
                <select
                  id="loading_style"
                  name="loading_style"
                  defaultValue={settings.loadingStyle}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="steps">Checklist steps</option>
                  <option value="pulse">Product pulse</option>
                  <option value="bar">Progress bar</option>
                </select>
              </div>
              <fieldset className="grid gap-2">
                <Label>Result screen buttons</Label>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {([
                    ['show_add_to_cart', 'Add to cart', settings.showAddToCart],
                    ['show_download', 'Download preview', settings.showDownload],
                    ['show_whatsapp', 'Request order / WhatsApp', settings.showWhatsapp],
                    ['show_try_again', 'Try with a different photo', settings.showTryAgain],
                  ] as const).map(([name, label, checked]) => (
                    <label key={name} className="flex items-center gap-2">
                      <input type="checkbox" name={name} defaultChecked={checked} className="size-4 accent-primary" />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid gap-2">
                <Label htmlFor="disclaimer_text">Disclaimer under the result (empty = default)</Label>
                <textarea
                  id="disclaimer_text"
                  name="disclaimer_text"
                  rows={2}
                  defaultValue={settings.disclaimerText ?? ''}
                  placeholder="This preview is visual guidance only..."
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="loading_steps">Loading steps (one per line, empty = default)</Label>
                <textarea
                  id="loading_steps"
                  name="loading_steps"
                  rows={4}
                  defaultValue={settings.loadingSteps?.join('\n') ?? ''}
                  placeholder={'Analyzing your photo\nFitting the garment\nRendering the final look'}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <Button type="submit" className="w-fit">Save settings</Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-4 content-start">
          <Card>
            <CardHeader>
              <CardTitle>Shopify install</CardTitle>
              <CardDescription>
                One click adds the try-on block to the store&apos;s product page.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button asChild className="w-fit">
                <a href={DEEP_LINK} target="_blank" rel="noopener noreferrer">
                  Add block to product page
                </a>
              </Button>
              <p className="text-sm text-muted-foreground">
                Opens the theme editor with the GrindCTRL Try-On block already placed.
                The merchant only clicks Save.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>The exact embed a store visitor sees.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/embed/try-on" target="_blank">Open embed preview</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/try-on" target="_blank">Open public demo</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent try-on jobs</CardTitle>
          <CardDescription>
            {jobs.length
              ? 'Live generation history (metadata only; customer photos are never stored).'
              : 'No generations recorded yet. Jobs appear here as customers use the try-on.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.id}</TableCell>
                    <TableCell>{row.product_id}</TableCell>
                    <TableCell>
                      <Badge variant={statusTone(row.status)}>{row.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{row.provider ?? '—'}</TableCell>
                    <TableCell>{row.cost_usd != null ? `$${Number(row.cost_usd).toFixed(3)}` : '—'}</TableCell>
                    <TableCell>{row.duration_ms != null ? `${(row.duration_ms / 1000).toFixed(1)}s` : '—'}</TableCell>
                    <TableCell className="text-xs">{new Date(row.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
