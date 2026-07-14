import type { Metadata } from 'next';
import Script from 'next/script';
import { ShopifyAdminSettings } from '@/components/shopify/admin-settings';
import { SHOPIFY_CLIENT_ID } from '@/lib/shopify/session-token';

export const metadata: Metadata = {
  title: 'GrindCTRL Try-On',
  robots: { index: false },
};

/* Embedded Shopify admin (Next.js): App Bridge script + session-token
   authenticated settings UI. Replaces the former React Router app. */
export default function ShopifyAdminPage() {
  return (
    <>
      <meta name="shopify-api-key" content={SHOPIFY_CLIENT_ID} />
      <Script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" strategy="beforeInteractive" />
      <main className="min-h-dvh bg-background text-foreground">
        <ShopifyAdminSettings />
      </main>
    </>
  );
}
