'use client';

import { useEffect } from 'react';
import { getShopifySessionToken } from '@/lib/shopify/app-bridge-client';

type Navigate = (url: string) => void;

function navigateTop(url: string): void {
  window.top!.location.href = url;
}

/** Shared by the automatic attempt and the persistent manual fallback. */
export async function startShopifyClaim(navigate: Navigate = navigateTop): Promise<void> {
  const token = await getShopifySessionToken();
  const response = await fetch('/api/shopify/claim/start', {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = (await response.json()) as { alreadyLinked?: boolean; token?: string };

  if (body.alreadyLinked) return;
  if (body.token) {
    navigate(`https://grindctrl.cloud/claim?token=${encodeURIComponent(body.token)}`);
  }
}

export function AutoClaim(_props: { locale: 'en' | 'ar' }) {
  useEffect(() => {
    let cancelled = false;

    void startShopifyClaim((url) => {
      if (!cancelled) navigateTop(url);
    }).catch(() => {
      // App Bridge may not be ready yet, or the navigation may be blocked.
      // The persistent manual button in ShopifyAppShell remains available.
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
