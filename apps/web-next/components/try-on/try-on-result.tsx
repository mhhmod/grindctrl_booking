'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Download, MessageCircle, ArrowRight, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TryOnJob } from '@/lib/try-on/types';
import { useTryOnLocale } from './locale-provider';

export type ResultControls = {
  showDownload?: boolean;
  showWhatsapp?: boolean;
  showAddToCart?: boolean;
  showTryAgain?: boolean;
  disclaimerText?: string | null;
};

interface TryOnResultProps {
  job: TryOnJob;
  productName: string;
  onReset: () => void;
  /** Inside a merchant storefront: primary CTA is add-to-cart, not trial. */
  shopMode?: boolean;
  controls?: ResultControls;
}

export function TryOnResult({ job, productName, onReset, shopMode, controls }: TryOnResultProps) {
  const { t } = useTryOnLocale();
  const [cartState, setCartState] = useState<'idle' | 'adding' | 'failed'>('idle');
  const [cartError, setCartError] = useState('');
  const ackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = {
    download: controls?.showDownload ?? true,
    whatsapp: controls?.showWhatsapp ?? true,
    addToCart: controls?.showAddToCart ?? true,
    tryAgain: controls?.showTryAgain ?? true,
  };
  const disclaimer =
    controls?.disclaimerText ||
    `${job.meta.runtime === 'mock' ? t.disclaimerMock : t.disclaimerLive}${t.colorsVary}`;

  useEffect(() => {
    // The host block acks the cart add; without an ack we surface a retry.
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'grindctrl-tryon:cart-result') {
        if (ackTimer.current) clearTimeout(ackTimer.current);
        setCartState(event.data.ok ? 'idle' : 'failed');
        setCartError(typeof event.data.message === 'string' ? event.data.message.slice(0, 160) : '');
      }
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      if (ackTimer.current) clearTimeout(ackTimer.current);
    };
  }, []);

  const handleAddToCart = () => {
    setCartState('adding');
    setCartError('');
    window.parent.postMessage({ type: 'grindctrl-tryon:add-to-cart' }, '*');
    ackTimer.current = setTimeout(() => setCartState('failed'), 5000);
  };

  const handleDownload = () => {
    if (!job.resultImageUrl) return;
    const link = document.createElement('a');
    link.href = job.resultImageUrl;
    link.download = `tryon-${job.productId}-preview.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="gc-result-reveal space-y-5">
      {/* Result image */}
      {job.resultImageUrl && (
        <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-xl border bg-muted/20 shadow-sm">
          <Image
            src={job.resultImageUrl}
            alt={`Try-on preview of ${productName}`}
            width={400}
            height={533}
            className="aspect-[3/4] w-full object-cover"
            priority
            unoptimized={job.resultImageUrl.startsWith('data:')}
          />

          {job.meta.runtime === 'mock' && (
            <div className="absolute start-3 top-3 inline-flex items-center rounded-full bg-amber-500/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-black backdrop-blur-sm">
              {t.demoBadge}
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-4">
            <p className="text-sm font-medium text-white">
              {productName} · {job.meta.runtime === 'mock' ? t.demoBadge : t.previewLabel}
            </p>
          </div>
        </div>
      )}

      {/* Primary CTA: conversion, full width, right under the image */}
      <div className="mx-auto w-full max-w-sm space-y-3">
        {shopMode ? (
          show.addToCart && (
            <Button
              size="lg"
              className="h-12 w-full gap-2 rounded-xl text-base"
              onClick={handleAddToCart}
              disabled={cartState === 'adding'}
              id="tryon-add-to-cart-btn"
            >
              <ShoppingCart className="size-4" />
              {cartState === 'adding'
                ? t.addedToCart
                : cartState === 'failed'
                  ? t.addToCartRetry
                  : t.addToCart}
            </Button>
          )
        ) : (
          <Button asChild size="lg" className="h-12 w-full gap-2 rounded-xl text-base">
            <Link href="/sign-up" id="tryon-trial-btn">
              {t.trial}
              <ArrowRight className="size-4 rtl:-scale-x-100" />
            </Link>
          </Button>
        )}
        {shopMode && show.addToCart && cartState === 'failed' && cartError && (
          <p className="text-center text-xs text-destructive">{cartError}</p>
        )}

        {/* Secondary utilities: one compact row */}
        {(show.download || show.whatsapp) && (
          <div className="flex gap-2">
            {show.download && (
              <Button
                onClick={handleDownload}
                variant="outline"
                className="h-10 flex-1 gap-2 rounded-xl text-sm"
                id="tryon-download-btn"
              >
                <Download className="size-4" />
                {t.download}
              </Button>
            )}
            {show.whatsapp && (
              <Button asChild variant="outline" className="h-10 flex-1 gap-2 rounded-xl text-sm">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(t.whatsappMsg(productName))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  id="tryon-whatsapp-btn"
                >
                  <MessageCircle className="size-4" />
                  {t.whatsapp}
                </a>
              </Button>
            )}
          </div>
        )}

        {/* Tertiary: try again as a quiet inline action */}
        {show.tryAgain && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="text-muted-foreground hover:text-foreground"
              id="tryon-reset-btn"
            >
              {t.tryDifferent}
            </Button>
          </div>
        )}

        <p className="text-center text-xs leading-relaxed text-muted-foreground/80">
          {disclaimer}
        </p>
      </div>
    </div>
  );
}
