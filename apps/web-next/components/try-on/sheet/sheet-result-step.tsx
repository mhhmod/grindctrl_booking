'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, Maximize2, MessageCircle, RefreshCw, ShoppingBag } from 'lucide-react';
import type { ResultControls } from '../try-on-result';
import type { TryOnLocale, TryOnTranslator } from '@/lib/try-on/i18n';
import type { SheetCopy } from '@/lib/try-on/sheet-copy';
import {
  formatStorePrice,
  sizeChoices,
  variantName,
  type StoreProduct,
} from '@/lib/try-on/store-product';
import type { TryOnJob } from '@/lib/try-on/types';
import { SheetCompareSlider } from './sheet-compare-slider';
import { LookViewer } from './look-viewer';
import { useMediaQuery } from './use-media-query';
import { SheetLayout } from './sheet-layout';

/* TryOn-Result (02-try-on.md): "Your look is ready" with the piece and its
   price, the look filling the top with Look and Your photo to compare,
   Change photo on the photo, then the options, and one Add to cart that
   names the variant it will add. A size changes only what is added, so it
   needs no new look. Picking another colour makes a new look, which waits
   for asynchronous looks (N38, N40); until then the tried colour shows
   as it is. Not right? waits for look feedback (N39). On a wide frame
   (TryOn-Desktop) the look and the photo share a before and after
   slider beside the details, and the title says how long the look took. */
export function SheetResultStep({
  copy,
  t,
  locale,
  job,
  photoDataUrl,
  productName,
  productImageUrl,
  storeProduct,
  triedVariantId,
  fallbackVariantTitle,
  controls,
  madeInSeconds = null,
  initialView = 'look',
  onChangePhoto,
  onForget,
  onImageError,
}: {
  copy: SheetCopy;
  t: TryOnTranslator;
  locale: TryOnLocale;
  job: TryOnJob;
  photoDataUrl: string | null;
  productName: string;
  /** The piece's own image, beside the look's header. */
  productImageUrl?: string;
  /** The store's own product, once the loader has handed it over. */
  storeProduct: StoreProduct | null;
  triedVariantId?: string;
  /** The tried variant's name from the loader, for when the product never arrives. */
  fallbackVariantTitle?: string;
  controls?: ResultControls;
  /** From the tap to the look in this page, for the desktop title. */
  madeInSeconds?: number | null;
  /** Which side of the compare opens first; the look unless a preview asks. */
  initialView?: 'look' | 'photo';
  onChangePhoto: () => void;
  onForget?: () => void;
  onImageError?: () => void;
}) {
  const wide = useMediaQuery('(min-width: 768px)');
  const [view, setView] = useState<'look' | 'photo'>(photoDataUrl ? initialView : 'look');
  const [fullScreen, setFullScreen] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [cart, setCart] = useState<{ state: 'idle' | 'adding' | 'added' | 'failed'; added: string; message: string }>({
    state: 'idle',
    added: '',
    message: '',
  });
  const ackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = {
    download: controls?.showDownload ?? true,
    whatsapp: controls?.showWhatsapp ?? true,
    addToCart: controls?.showAddToCart ?? true,
    changePhoto: controls?.showTryAgain ?? true,
  };

  const tried = storeProduct?.variants.find((variant) => variant.id === triedVariantId) ?? null;
  const sizes = storeProduct && tried ? sizeChoices(storeProduct, tried) : { index: -1, variants: [] };
  const picked = (pickedId && sizes.variants.find((variant) => variant.id === pickedId)) || tried;
  const pickedName = picked ? variantName(picked.title, locale) : variantName(fallbackVariantTitle ?? '', locale);
  const price =
    picked?.price !== null && picked?.price !== undefined && storeProduct?.currency
      ? formatStorePrice(picked.price, storeProduct.currency, locale)
      : '';
  const soldOut = picked ? !picked.available : false;

  useEffect(() => {
    // The loader acks every add: what it added, or why it could not.
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || event.data?.type !== 'grindctrl-tryon:cart-result') return;
      if (ackTimer.current) clearTimeout(ackTimer.current);
      if (event.data.ok) {
        const added = typeof event.data.variantTitle === 'string' ? variantName(event.data.variantTitle, locale) : '';
        setCart({ state: 'added', added, message: '' });
        return;
      }
      setCart({ state: 'failed', added: '', message: typeof event.data.message === 'string' ? event.data.message.slice(0, 160) : '' });
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      if (ackTimer.current) clearTimeout(ackTimer.current);
    };
  }, [locale]);

  const addToCart = () => {
    if (controls?.backToProduct) {
      window.parent.postMessage({ type: 'grindctrl-tryon:back-to-product' }, '*');
      return;
    }
    setCart({ state: 'adding', added: '', message: '' });
    window.parent.postMessage({ type: 'grindctrl-tryon:add-to-cart', variantId: picked?.id ?? triedVariantId }, '*');
    ackTimer.current = setTimeout(() => setCart({ state: 'failed', added: '', message: '' }), 5000);
  };

  const saveLook = () => {
    if (!job.resultImageUrl) return;
    const link = document.createElement('a');
    link.href = job.resultImageUrl;
    link.download = `tryon-${job.productId}-preview.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const otherOptions = storeProduct && tried ? storeProduct.options.map((name, index) => ({ name, index })).filter(({ index }) => index !== sizes.index) : [];

  // The look's own header takes the product row's place, pinned like it.
  const heading = (
    <header className="flex items-center gap-3">
      {productImageUrl && (
        // The store's own product image, already on its CDN.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={productImageUrl} alt="" className="size-14 shrink-0 rounded-lg object-cover short:size-10" />
      )}
      <div className="min-w-0 space-y-0.5">
        <h2 className="text-xl font-semibold tracking-tight text-foreground short:text-lg">
          {wide && madeInSeconds ? copy.readyIn(madeInSeconds) : copy.lookReady}
        </h2>
        <p className="truncate text-sm text-muted-foreground">{price ? `${productName} · ${price}` : productName}</p>
      </div>
    </header>
  );

  const visual =
    wide && photoDataUrl && job.resultImageUrl ? (
      // As tall as the frame allows beside the details, never taller.
      <div className="mx-auto w-full max-w-[clamp(12rem,calc((100dvh-16rem)*0.75),100%)] space-y-3">
        <SheetCompareSlider
          photoSrc={photoDataUrl}
          lookSrc={job.resultImageUrl}
          label={copy.compareLabel}
          photoLabel={copy.yourPhoto}
          lookLabel={copy.yourLook}
          lookAlt={copy.lookAlt(productName)}
          photoAlt={copy.originalPhotoAlt}
          aiPreview={copy.aiPreview}
          rtl={locale === 'ar'}
          onLookError={onImageError}
        />
        {show.changePhoto && (
          <div className="flex justify-center">
            <button type="button" onClick={onChangePhoto} className={SECONDARY_INLINE}>
              <RefreshCw className="size-4" aria-hidden="true" />
              {copy.changePhoto}
            </button>
          </div>
        )}
      </div>
    ) : (
      <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-2xl border bg-muted/30">
        {/* A tap opens the look full screen (LookViewer). */}
        <button type="button" onClick={() => setFullScreen(true)} aria-label={copy.viewFullScreen} className="block cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-ring">
          {view === 'look' ? (
            // The look lives in this page as a data or blob URL.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={job.resultImageUrl ?? ''} alt={copy.lookAlt(productName)} onError={onImageError} className={LOOK_SIZE} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoDataUrl ?? ''} alt={copy.originalPhotoAlt} className={LOOK_SIZE} />
          )}
          <span aria-hidden="true" className="absolute bottom-3 end-3 grid size-9 place-items-center rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur">
            <Maximize2 className="size-4" />
          </span>
        </button>

        <div role="group" aria-label={copy.compare} className="absolute end-3 top-3 flex rounded-full bg-background/90 p-1 text-sm shadow-sm backdrop-blur">
          {(['look', 'photo'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => setView(option)}
              disabled={option === 'photo' && !photoDataUrl}
              className={`min-h-11 rounded-full px-3 font-medium focus-visible:outline-2 focus-visible:outline-ring ${view === option ? 'bg-foreground text-background' : 'text-foreground'}`}
            >
              {option === 'look' ? copy.viewLook : copy.yourPhoto}
            </button>
          ))}
        </div>

        {view === 'look' ? (
          <span className="absolute bottom-3 start-3 rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur">
            {copy.aiPreview}
          </span>
        ) : (
          show.changePhoto && (
            <div className="absolute inset-x-0 bottom-3 flex justify-center">
              <button
                type="button"
                onClick={onChangePhoto}
                className="flex min-h-11 items-center gap-2 rounded-full bg-background/95 px-4 text-sm font-medium text-foreground shadow-sm focus-visible:outline-2 focus-visible:outline-ring"
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                {copy.changePhoto}
              </button>
            </div>
          )
        )}
      </div>
    );

  const options = (
    <>
      {tried && (otherOptions.length > 0 || sizes.variants.length > 0) && (
        <div className="space-y-4">
          {otherOptions.map(({ name, index }) => (
            <p key={name} className="flex items-baseline gap-2 text-sm">
              <span className="text-muted-foreground">{name}</span>
              <span className="font-medium text-foreground">{tried.options[index]}</span>
            </p>
          ))}
          {sizes.variants.length > 0 && (
            <div className="space-y-2">
              <p id="gc-size-label" className="text-sm text-muted-foreground">
                {storeProduct!.options[sizes.index]}
              </p>
              <div role="radiogroup" aria-labelledby="gc-size-label" className="flex flex-wrap gap-2">
                {sizes.variants.map((variant) => {
                  const value = variant.options[sizes.index];
                  const checked = variant.id === picked?.id;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      aria-label={variant.available ? value : copy.soldOutOption(value)}
                      onClick={() => setPickedId(variant.id)}
                      className={`min-h-11 min-w-11 rounded-xl border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${checked ? 'border-foreground bg-foreground text-background' : variant.available ? 'text-foreground' : 'border-dashed text-muted-foreground'}`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

    </>
  );
  const cartAction = show.addToCart && (
    <div className="space-y-2">
      <button
        type="button"
        onClick={addToCart}
        disabled={!controls?.backToProduct && (soldOut || cart.state === 'adding')}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {controls?.backToProduct
          ? <ArrowLeft className="size-5 rtl:-scale-x-100" aria-hidden="true" />
          : <ShoppingBag className="size-5" aria-hidden="true" />}
        {controls?.backToProduct ? copy.backToProduct : soldOut
          ? copy.soldOut
          : cart.state === 'adding'
            ? copy.adding
            : cart.state === 'failed'
              ? t.addToCartRetry
              : copy.addToCart(pickedName)}
      </button>
      {cart.state === 'added' && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm">
          <span className="min-w-0 truncate">{t.addedVariant(cart.added)}</span>
          <button
            type="button"
            onClick={() => window.parent.postMessage({ type: 'grindctrl-tryon:checkout' }, '*')}
            className="min-h-11 shrink-0 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            {t.checkout}
          </button>
        </div>
      )}
      {cart.state === 'failed' && cart.message && <p className="text-center text-xs text-destructive">{cart.message}</p>}
    </div>
  );

  const shareActions = (show.download || show.whatsapp) && (
    <div className="flex gap-2">
      {show.download && (
        <button type="button" onClick={saveLook} className={SECONDARY}>
          <Download className="size-4" aria-hidden="true" />
          {wide ? copy.saveImage : copy.savePhoto}
        </button>
      )}
      {show.whatsapp && (
        <a
          href={`https://wa.me/?text=${encodeURIComponent(t.whatsappMsg(productName))}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.whatsapp}
          className={SECONDARY}
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          {/* One line beside Save photo on a phone; the icon and the full
              name for screen readers carry the rest. */}
          <span aria-hidden="true">{copy.whatsappShort}</span>
        </a>
      )}
    </div>
  );

  /* Add to cart is the step's action, pinned in the footer; saving and
     sharing take its place when the store hides it. Everything else ends
     the scrolling body. */
  const primary = cartAction || shareActions;
  const rest = (
    <>
      {cartAction && shareActions}
      {onForget && <button type="button" onClick={onForget} className="min-h-11 self-center rounded-lg px-3 text-sm text-muted-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">{copy.forgetOnPhone}</button>}
      <p className="text-center text-xs leading-relaxed text-muted-foreground">{controls?.disclaimerText || copy.disclaimer}</p>
    </>
  );

  // Desktop (TryOn-Desktop): the slider beside the details, the action under them.
  return wide ? (
    <SheetLayout
      wide
      header={heading}
      footer={primary && <div className="grid grid-cols-2 gap-8"><div className="col-start-2">{primary}</div></div>}
    >
      <div className="grid grid-cols-2 items-start gap-8">
        {visual}
        <div className="flex flex-col gap-5">
          {options}
          {rest}
        </div>
      </div>
    </SheetLayout>
  ) : (
    <SheetLayout
      header={heading}
      footer={primary}
      overlay={
        fullScreen && job.resultImageUrl && (
          <LookViewer
            lookSrc={job.resultImageUrl}
            photoSrc={photoDataUrl}
            initial={view}
            labels={{ title: copy.viewerTitle, close: copy.closeViewer, look: copy.viewLook, photo: copy.yourPhoto, save: show.download ? copy.savePhoto : null,
              lookAlt: copy.lookAlt(productName), photoAlt: copy.originalPhotoAlt, zoomHint: copy.zoomHint }}
            onSave={show.download ? saveLook : undefined}
            onClose={() => setFullScreen(false)}
          />
        )
      }
    >
      {visual}
      {options}
      {rest}
    </SheetLayout>
  );
}

/* The look fills what the pinned header and Add to cart leave, keeping the
   sizes under it in reach; a tap opens it full screen. */
const LOOK_SIZE = 'block aspect-[3/4] h-[clamp(10rem,calc(100dvh-20rem),28rem)] w-auto max-w-full object-cover';

const SECONDARY =
  'flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
const SECONDARY_INLINE =
  'flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-ring';
