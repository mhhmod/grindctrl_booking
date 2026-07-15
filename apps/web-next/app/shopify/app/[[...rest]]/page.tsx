import type { Metadata } from 'next';
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
      {/* Plain sync script: executes during HTML parse, before hydration.
          next/script beforeInteractive only works in the root layout. */}
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
      {/* The settings UI owns its own light/dark shell (merchant-toggleable). */}
      <main>
        <ShopifyAdminSettings />
      </main>
    </>
  );
}
