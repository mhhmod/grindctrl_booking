import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CopyButton } from '@/components/dashboard/copy-button';

const WIDGET_SNIPPET = `<script\n  src="https://grindctrl.cloud/scripts/grindctrl-support.js"\n  data-site-key="gc_your_site_key_here"\n  async\n></script>`;

export default function DashboardInstallPage() {
  return (
    <section className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Widget / Embed</Badge>
            <Badge variant="outline">Preview-ready</Badge>
            <Badge variant="outline">Ready to connect</Badge>
          </div>
          <CardTitle>Widget Embed and Install Center</CardTitle>
          <CardDescription>Use placeholder key for review. Do not place production secrets in browser code.</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-base">Install snippet</CardTitle>
              <CardDescription>Copy this script block into your website template.</CardDescription>
            </div>
            <CopyButton value={WIDGET_SNIPPET} label="Copy snippet" />
          </CardHeader>
          <CardContent className="grid gap-4">
            <pre className="overflow-x-auto rounded-xl border bg-muted/20 p-4 text-xs text-muted-foreground" dir="ltr">
              <code>{WIDGET_SNIPPET}</code>
            </pre>

            <ol className="list-decimal space-y-2 ps-5 text-sm text-foreground">
              <li>
                Paste snippet before closing <code className="font-mono text-xs">{'</body>'}</code> tag.
              </li>
              <li>Replace `gc_your_site_key_here` with your assigned site key.</li>
              <li>Publish site and verify domain before enabling live actions.</li>
            </ol>

            <div className="rounded-xl border bg-muted/20 p-3 text-sm text-muted-foreground">
              Domain verification concept: allowlisted production domains + optional localhost for testing.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Widget preview</CardTitle>
            <CardDescription>Launcher + quick actions preview (no live send).</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="ms-auto inline-flex items-center gap-2 rounded-full border bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
              GRINDCTRL Support
            </div>
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="text-sm font-semibold text-foreground">Hi there</p>
              <p className="mt-1 text-sm text-muted-foreground">How can we help today?</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline">Support</Badge>
                <Badge variant="outline">Lead capture</Badge>
                <Badge variant="outline">File intake</Badge>
              </div>
              <Button type="button" className="mt-4 w-full" disabled aria-disabled="true">
                Start conversation (Preview only)
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">Powered by GrindCTRL</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
