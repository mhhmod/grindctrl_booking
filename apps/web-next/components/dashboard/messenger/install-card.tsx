'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { setMessengerEnabled } from '@/app/dashboard/messenger/actions';

/* Installation: honest status (Configured vs Detected), the one-step Shopify
   enable flow, a universal script for other platforms, and a quiet
   troubleshooting section. */

const COPY = {
  en: {
    title: 'Installation',
    subtitle: 'Put the messenger on your store.',
    statusLive: 'Live on your store',
    statusDetected: 'Enabled — waiting to be seen on your storefront',
    statusOff: 'Off',
    shopifyTitle: 'Shopify',
    shopifyStep1: 'Open your theme editor → App embeds.',
    shopifyStep2: 'Toggle “GRINDCTRL Support Messenger” on and save.',
    openThemeEditor: 'Enable in Shopify',
    scriptTitle: 'Other platforms',
    scriptNote: 'Paste this just before </body>. Works on any website.',
    copy: 'Copy',
    copied: 'Copied!',
    toggleOn: 'Turn on Messenger',
    toggling: 'Working…',
    troubleshoot: 'Troubleshoot installation',
    lastSeen: 'Last storefront check',
    never: 'Never',
    domain: 'Storefront domain',
    version: 'Configuration version',
    connectHint:
      'Connect this site to a store domain so shopper identity can be verified. Until then only anonymous chat is available.',
  },
  ar: {
    title: 'التثبيت',
    subtitle: 'ضع الماسنجر على متجرك.',
    statusLive: 'يعمل على متجرك',
    statusDetected: 'مفعّل — في انتظار أول زيارة من متجرك',
    statusOff: 'متوقف',
    shopifyTitle: 'شوبيفاي',
    shopifyStep1: 'افتح محرر القالب ← App embeds.',
    shopifyStep2: 'فعّل “GRINDCTRL Support Messenger” واحفظ.',
    openThemeEditor: 'التفعيل من شوبيفاي',
    scriptTitle: 'منصات أخرى',
    scriptNote: 'الصق هذا الكود قبل نهاية الصفحة. يعمل على أي موقع.',
    copy: 'نسخ',
    copied: 'تم النسخ!',
    toggleOn: 'تشغيل الماسنجر',
    toggling: 'جارٍ التنفيذ…',
    troubleshoot: 'فحص التثبيت',
    lastSeen: 'آخر ظهور في المتجر',
    never: 'أبداً',
    domain: 'نطاق المتجر',
    version: 'إصدار الإعدادات',
    connectHint:
      'اربط هذا الموقع بنطاق متجرك للتحقق من هوية العملاء. حتى ذلك الحين يتوفر الدردشة للزوار فقط.',
  },
};

export function InstallCard({
  locale,
  siteId,
  embedKey,
  domain,
  active,
  detectedAt,
  version,
}: {
  locale: string;
  siteId: string;
  embedKey: string;
  domain: string | null;
  active: boolean;
  detectedAt: string | null;
  version: number;
}) {
  const t = COPY[locale === 'ar' ? 'ar' : 'en'];
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const snippet = `<script async src="https://grindctrl.cloud/widget/v1/messenger.js" data-key="${embedKey}"></script>`;

  const status = active
    ? detectedAt
      ? { label: t.statusLive, tone: 'bg-emerald-500' }
      : { label: t.statusDetected, tone: 'bg-amber-500' }
    : { label: t.statusOff, tone: 'bg-zinc-400' };

  return (
    <section className="grid min-w-0 gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t.title}</h2>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <span className="flex items-center gap-2 text-sm">
          <span aria-hidden="true" className={`inline-block size-2.5 rounded-full ${status.tone}`} />
          {status.label}
        </span>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold">{t.shopifyTitle}</h3>
          <ol className="mt-2 grid list-decimal gap-1 ps-5 text-sm text-muted-foreground">
            <li>{t.shopifyStep1}</li>
            <li>{t.shopifyStep2}</li>
          </ol>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {domain ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`https://admin.shopify.com/store/${domain.replace(/\.myshopify\.com$/, '')}/themes`}>
                  {t.openThemeEditor}
                </Link>
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">{t.connectHint}</p>
            )}
            {!active && (
              <Button size="sm" disabled={pending} onClick={() => startTransition(() => void setMessengerEnabled(siteId, true))}>
                {pending ? t.toggling : t.toggleOn}
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold">{t.scriptTitle}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{t.scriptNote}</p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-muted/60 p-3 text-[11px] leading-relaxed" dir="ltr">
            <code>{snippet}</code>
          </pre>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(snippet);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="mt-2 rounded-full border border-border px-3 py-1 text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2"
          >
            {copied ? t.copied : t.copy}
          </button>
        </div>
      </div>

      <details className="rounded-xl border border-border p-4">
        <summary className="cursor-pointer text-sm font-medium">{t.troubleshoot}</summary>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">{t.lastSeen}</dt>
            <dd>{detectedAt ? new Date(detectedAt).toLocaleString() : t.never}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t.domain}</dt>
            <dd dir="ltr" className="truncate font-mono text-xs">
              {domain ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t.version}</dt>
            <dd>v{version}</dd>
          </div>
        </dl>
      </details>

      <p className="text-xs text-muted-foreground">
        <Badge variant="outline" className="me-2">key</Badge>
        <code dir="ltr" className="font-mono">{embedKey}</code>
      </p>
    </section>
  );
}
