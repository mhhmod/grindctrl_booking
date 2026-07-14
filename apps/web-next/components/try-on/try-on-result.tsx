'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Download, MessageCircle, ArrowRight, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TryOnJob } from '@/lib/try-on/types';
import { useTryOnLocale } from './locale-provider';

interface TryOnResultProps {
  job: TryOnJob;
  productName: string;
  onReset: () => void;
  /** Inside a merchant storefront: primary CTA is add-to-cart, not trial. */
  shopMode?: boolean;
}

export function TryOnResult({ job, productName, onReset, shopMode }: TryOnResultProps) {
  const { t } = useTryOnLocale();
  const [carted, setCarted] = useState(false);

  const handleAddToCart = () => {
    setCarted(true);
    // The host block (tryon.js) adds the variant via /cart/add.js.
    window.parent.postMessage({ type: 'grindctrl-tryon:add-to-cart' }, '*');
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
    <div className="gc-result-reveal space-y-6">
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

          {/* Demo / mock badge */}
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

      {/* CTA buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button
          onClick={handleDownload}
          variant="outline"
          size="lg"
          className="h-11 gap-2 rounded-xl"
          id="tryon-download-btn"
        >
          <Download className="size-4" />
          {t.download}
        </Button>

        <Button
          asChild
          variant="outline"
          size="lg"
          className="h-11 gap-2 rounded-xl"
        >
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

        {shopMode ? (
          <Button
            size="lg"
            className="h-11 gap-2 rounded-xl"
            onClick={handleAddToCart}
            disabled={carted}
            id="tryon-add-to-cart-btn"
          >
            <ShoppingCart className="size-4" />
            {carted ? t.addedToCart : t.addToCart}
          </Button>
        ) : (
          <Button asChild size="lg" className="h-11 gap-2 rounded-xl">
            <Link href="/sign-up" id="tryon-trial-btn">
              {t.trial}
              <ArrowRight className="size-4 rtl:-scale-x-100" />
            </Link>
          </Button>
        )}
      </div>

      {/* Disclaimer */}
      <p className="mx-auto max-w-md text-center text-xs text-muted-foreground">
        {job.meta.runtime === 'mock' ? t.disclaimerMock : t.disclaimerLive}
        {t.colorsVary}
      </p>

      {/* Try again */}
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
    </div>
  );
}
