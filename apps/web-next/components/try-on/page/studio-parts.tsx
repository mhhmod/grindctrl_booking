'use client';

/* The pieces of the /try-on studio: the journey, the piece, photo and look
   cards, the joiners between them, the action bar and the looks tray.
   Built fresh for this page; the embedded storefront try-on keeps its own
   TryOnDemo and TryOnResult untouched. */

import * as React from 'react';
import Image, { getImageProps } from 'next/image';
import { preload } from 'react-dom';
import { ShopifyMark } from '@/components/brand-marks';
import { SiteBadge } from '@/components/site/chip';
import {
  AlertIcon,
  ArrowIcon,
  CameraIcon,
  CompareIcon,
  DownloadIcon,
  EqualsIcon,
  ExtIcon,
  HangerIcon,
  PersonIcon,
  PhotoIcon,
  PlusIcon,
  ShieldIcon,
  SparkleIcon,
  SwapIcon,
  TagIcon,
  TickIcon,
  UploadIcon,
} from '@/components/site/icons';
import { trackClick } from '@/lib/analytics';
import type { TryOnTranslator } from '@/lib/try-on/i18n';
import { cn } from '@/lib/utils';
import {
  downloadName,
  PIECES,
  photoSrc,
  SAMPLE_PHOTOS,
  type Look,
  type PieceKey,
  type StudioState,
} from './studio-state';

export const DEMO_STORE_URL = 'https://grindctrl.myshopify.com';

type StepStatus = 'done' | 'current' | 'later';

export function stepStatus(step: number, current: number): StepStatus {
  if (step < current) return 'done';
  if (step === current) return 'current';
  return 'later';
}

const STEP_ICONS = [HangerIcon, CameraIcon, SparkleIcon, PersonIcon];

export function StepDisc({ step, status, size = 26 }: { step: number; status: StepStatus; size?: number }) {
  const Icon = status === 'done' ? TickIcon : STEP_ICONS[step - 1];
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        status === 'later' ? 'bg-secondary text-muted-foreground' : 'bg-foreground text-background',
      )}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.55)} strokeWidth={2} />
    </span>
  );
}

/* ─── Journey ─── */

export function Journey({
  t,
  current,
  variant,
}: {
  t: TryOnTranslator;
  current: number;
  variant: 'header' | 'panel';
}) {
  const labels = [t.pageStepPiece, t.pageStepPhoto, t.pageStepCreate, t.pageStepLook];
  const panel = variant === 'panel';
  return (
    <ol
      aria-label={t.pageStepsLabel}
      className={cn('flex', panel ? 'w-full items-start gap-0.5' : 'items-center gap-2 xl:gap-2')}
    >
      {labels.map((label, index) => {
        const step = index + 1;
        const status = stepStatus(step, current);
        return (
          <React.Fragment key={label}>
            <li
              aria-current={status === 'current' ? 'step' : undefined}
              className={cn(
                'flex font-semibold',
                panel
                  ? 'min-w-0 flex-[0_1_64px] flex-col items-center gap-1.5 text-center text-[11.5px]'
                  : 'items-center gap-2 whitespace-nowrap text-[13px]',
                status === 'later' ? 'text-muted-foreground' : 'text-foreground',
              )}
            >
              <StepDisc step={step} status={status} size={panel ? 34 : 26} />
              <span className={panel ? 'whitespace-nowrap' : undefined}>{label}</span>
            </li>
            {step < 4 ? (
              <li
                aria-hidden="true"
                className={cn(
                  'h-0.5 rounded-[1px]',
                  panel ? 'mt-[17px] min-w-2 flex-1' : 'w-4 xl:w-[26px]',
                  step < current ? 'bg-foreground' : 'bg-border',
                )}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </ol>
  );
}

/* ─── Shared bits ─── */

function SmallButton({
  children,
  onClick,
  ariaLabel,
  icon,
  buttonRef,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel?: string;
  icon?: React.ReactNode;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-border px-3 text-[13px] font-semibold text-foreground hover:bg-foreground/[0.06] lg:h-9"
    >
      {icon}
      {children}
    </button>
  );
}

function CardHead({
  step,
  status,
  titleId,
  title,
  end,
}: {
  step: number;
  status: StepStatus;
  titleId: string;
  title: string;
  end?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center gap-2.5 pe-1.5 ps-1">
      <StepDisc step={step} status={status} />
      <h2 id={titleId} className="min-w-0 flex-1 text-[15px] font-bold">
        {title}
      </h2>
      {end}
    </div>
  );
}

const CARD = 'relative flex flex-col rounded-[26px] border border-border bg-card p-2.5 shadow-[var(--gc-shadow-float)]';

/* ─── The piece ─── */

const DESK_PIECE_SIZES = '(min-width: 1280px) 280px, 240px';

export function PieceCard({
  t,
  piece,
  swapKey,
  onChange,
  changeRef,
}: {
  t: TryOnTranslator;
  piece: PieceKey;
  swapKey: number;
  onChange: () => void;
  changeRef?: React.Ref<HTMLButtonElement>;
}) {
  const copy = t.pagePieces[piece];
  const change = (
    <SmallButton onClick={onChange} ariaLabel={t.pageChangePiece} icon={<SwapIcon size={14} strokeWidth={1.9} />} buttonRef={changeRef}>
      {t.pageChange}
    </SmallButton>
  );
  /* The desktop card's image is the largest first paint on a desktop
     screen. Its card is hidden on phones, so instead of loading it eagerly
     (phones would download it for nothing) a preload scoped to the desktop
     media query starts it with the page. */
  const desk = getImageProps({ src: PIECES[piece].garment, alt: copy.name, fill: true, sizes: DESK_PIECE_SIZES }).props;
  preload(desk.src, {
    as: 'image',
    imageSrcSet: desk.srcSet,
    imageSizes: desk.sizes,
    fetchPriority: 'high',
    media: '(min-width: 1024px)',
  });
  return (
    <>
      {/* Phones: one row. */}
      <section
        aria-labelledby="tp-piece-m"
        className="flex items-center gap-3.5 rounded-[22px] border border-border bg-card p-3 lg:hidden"
      >
        <span className="relative h-24 w-[76px] shrink-0 overflow-hidden rounded-[14px] bg-gc-studio">
          <Image
            key={`m-${swapKey}`}
            src={PIECES[piece].garment}
            alt={copy.name}
            fill
            sizes="76px"
            className="gc-anim-swap object-contain"
          />
        </span>
        <div className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <StepDisc step={1} status="done" />
            <h2 id="tp-piece-m" className="text-[12.5px] font-bold text-muted-foreground">
              {t.pageStepPiece}
            </h2>
          </span>
          <span className="mt-1.5 block text-base font-bold">{copy.name}</span>
          <span className="mt-0.5 block text-[12.5px] text-muted-foreground">{copy.kind}</span>
        </div>
        {change}
      </section>

      {/* Desktop */}
      <section aria-labelledby="tp-piece" className={cn(CARD, 'hidden lg:flex')}>
        <CardHead step={1} status="done" titleId="tp-piece" title={t.pageStepPiece} end={change} />
        <div className="relative h-[360px] overflow-hidden rounded-[18px] bg-gc-studio">
          <Image
            key={`d-${swapKey}`}
            src={PIECES[piece].garment}
            alt={copy.name}
            fill
            sizes={DESK_PIECE_SIZES}
            className="gc-anim-swap object-contain p-3.5"
          />
        </div>
        <div className="px-2 pb-1.5 pt-3.5">
          <span className="block text-[17px] font-bold">{copy.name}</span>
          <span className="mt-2 flex flex-wrap items-center gap-1.5">
            <SiteBadge icon={<PersonIcon size={13} strokeWidth={1.9} />}>{copy.kind}</SiteBadge>
            <SiteBadge icon={<TagIcon size={13} strokeWidth={1.9} />}>{t.pageDemoPiece}</SiteBadge>
          </span>
        </div>
      </section>
    </>
  );
}

/* ─── Your photo ─── */

export function PhotoCard({
  t,
  state,
  onFile,
  onUseSample,
  onClear,
  status,
}: {
  t: TryOnTranslator;
  state: StudioState;
  onFile: (file: File) => void;
  onUseSample: () => void;
  onClear: () => void;
  status: StepStatus;
}) {
  const inputId = React.useId();
  const errorId = React.useId();
  const [dragging, setDragging] = React.useState(false);
  const photo = state.photo;
  const sampleThumb = SAMPLE_PHOTOS[PIECES[state.piece].model];

  const onDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <section aria-labelledby="tp-photo" className={CARD}>
      <CardHead
        step={2}
        status={status}
        titleId="tp-photo"
        title={t.pageStepPhoto}
        end={
          photo ? (
            <SmallButton onClick={onClear} ariaLabel={t.changePhoto} icon={<SwapIcon size={14} strokeWidth={1.9} />}>
              {t.pageChange}
            </SmallButton>
          ) : null
        }
      />
      {photo ? (
        <>
          <div className="relative h-[300px] overflow-hidden rounded-[18px] bg-gc-studio lg:h-[360px]">
            {/* An uploaded photo is a data URL; next/image adds nothing there. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={photo.kind === 'sample' ? photo.model : 'upload'}
              src={photoSrc(photo)}
              alt={photo.kind === 'sample' ? t.pageSamplePhoto : t.photoLabel}
              className="gc-anim-in absolute inset-0 size-full object-cover object-[50%_18%]"
            />
            <span className="absolute start-2.5 top-2.5 inline-flex h-7 items-center gap-1.5 rounded-full bg-card/95 pe-[11px] ps-2 text-[11.5px] font-bold">
              {photo.kind === 'upload' ? <CameraIcon size={14} strokeWidth={1.9} /> : <SparkleIcon size={14} strokeWidth={1.9} />}
              {photo.kind === 'upload' ? t.photoLabel : t.pageSamplePhoto}
            </span>
          </div>
          <p className="mx-1.5 mb-1 mt-3 flex items-start gap-2 text-[12.5px] leading-[1.45] text-muted-foreground">
            <ShieldIcon size={15} className="mt-px shrink-0" />
            <span>{t.privacyText}</span>
          </p>
        </>
      ) : (
        <div>
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-describedby={state.fileError ? errorId : undefined}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFile(file);
              event.target.value = '';
            }}
          />
          <label
            htmlFor={inputId}
            data-drop=""
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex h-[176px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[18px] border-[1.5px] border-dashed bg-gc-studio px-[18px] text-center hover:border-foreground has-[+input:focus-visible]:border-foreground lg:h-[292px]',
              dragging ? 'border-foreground' : 'border-gc-inactive',
            )}
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-card">
              <UploadIcon size={20} />
            </span>
            <span className="text-[15px] font-bold">{t.pageAddPhoto}</span>
            <span className="text-[12.5px] leading-[1.45] text-muted-foreground">{t.pageUploadRules}</span>
          </label>
          <div aria-live="polite">
            {state.fileError ? (
              <p id={errorId} role="alert" className="mx-0.5 mt-2 text-[12.5px] text-gc-error">
                {state.fileError === 'size' ? t.errTooLarge(8) : t.pageErrType}
              </p>
            ) : null}
          </div>
          <div className="mx-1 my-3 flex items-center gap-2.5 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-secondary" />
            {t.pageOr}
            <span className="h-px flex-1 bg-secondary" />
          </div>
          <button
            type="button"
            onClick={onUseSample}
            className="flex h-14 w-full items-center gap-3 rounded-2xl border border-border px-2 text-start text-foreground hover:bg-foreground/[0.03]"
          >
            <span className="relative size-10 shrink-0 overflow-hidden rounded-xl">
              <Image src={sampleThumb} alt="" fill sizes="40px" className="object-cover object-[50%_12%]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{t.pageUseSample}</span>
              <span className="block text-xs text-muted-foreground">{t.pageSampleModel}</span>
            </span>
            <ArrowIcon size={16} strokeWidth={1.9} data-icon="inline-end" className="shrink-0 rtl:-scale-x-100" />
          </button>
        </div>
      )}
    </section>
  );
}

/* ─── Joiners ─── */

export function Joiner({ glyph, busy }: { glyph: 'plus' | 'equals'; busy: boolean }) {
  const Icon = glyph === 'plus' ? PlusIcon : EqualsIcon;
  return (
    <div aria-hidden="true" className="relative flex h-[52px] items-center justify-center lg:h-auto">
      <span
        className={cn(
          'relative flex size-10 items-center justify-center rounded-full shadow-[0_10px_24px_-14px_rgb(32_29_27/0.6)]',
          busy ? 'bg-foreground text-background' : 'bg-card text-foreground',
        )}
      >
        <Icon size={18} strokeWidth={2.2} />
        <span
          className={cn(
            'gc-anim-spin absolute -inset-[5px] rounded-full border-[1.5px] border-dashed border-foreground',
            busy ? 'opacity-70' : 'opacity-0',
          )}
        />
      </span>
    </div>
  );
}

/* ─── Your look ─── */

function Silhouette({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 110 160"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
      className={cn('h-[130px] w-[90px] lg:h-40 lg:w-[110px]', className)}
    >
      <circle cx="55" cy="30" r="17" />
      <path d="M20 156V98c0-22 16-40 35-40s35 18 35 40v58" />
    </svg>
  );
}

export function LookCard({
  t,
  state,
  look,
  step,
  status,
  failureMessage,
  retryLocked,
  onRetry,
  onUseSample,
  onView,
  cardRef,
}: {
  t: TryOnTranslator;
  state: StudioState;
  look: Look | null;
  step: number;
  status: StepStatus;
  failureMessage: string | null;
  retryLocked: boolean;
  onRetry: () => void;
  onUseSample: () => void;
  onView: (view: 'look' | 'photo') => void;
  cardRef: React.Ref<HTMLElement>;
}) {
  const done = state.stage === 'done' && look;
  const photoView = done && state.view === 'photo';
  const shownImage = done ? (photoView ? photoSrc(look.photo) : look.image) : null;
  const progress = state.stage === 'creating' ? Math.round(((step + 1) / t.loadingSteps.length) * 100) : 4;

  return (
    <section
      ref={cardRef}
      data-lookcard=""
      aria-labelledby="tp-look"
      aria-live="polite"
      className={cn(CARD, 'scroll-m-[90px]')}
    >
      <CardHead
        step={4}
        status={status}
        titleId="tp-look"
        title={t.pageStepLook}
        end={
          done ? (
            <div role="group" aria-label={t.pageCompareWithPhoto} className="flex rounded-full bg-secondary p-[3px]">
              {(['photo', 'look'] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  aria-pressed={state.view === view}
                  onClick={() => onView(view)}
                  className={cn(
                    'h-[30px] min-w-11 rounded-full px-3 text-[12.5px] font-bold',
                    state.view === view ? 'bg-foreground text-background' : 'text-foreground',
                  )}
                >
                  {view === 'photo' ? t.pageViewPhoto : t.pageViewLook}
                </button>
              ))}
            </div>
          ) : null
        }
      />
      <div className="relative h-[440px] overflow-hidden rounded-[18px] bg-gc-studio lg:h-[520px]">
        {state.stage === 'idle' || state.stage === 'ready' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gc-inactive">
            <Silhouette />
            <span className="text-sm font-semibold text-muted-foreground">{t.pageLookEmpty}</span>
          </div>
        ) : null}

        {state.stage === 'creating' && state.photo ? (
          <div className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoSrc(state.photo)}
              alt=""
              className="absolute inset-0 size-full scale-[1.04] object-cover object-[50%_18%] opacity-55 blur-[6px] saturate-[0.6]"
            />
            <div
              aria-hidden="true"
              className="gc-anim-scan absolute inset-x-0 top-0 h-[36%] bg-[linear-gradient(180deg,transparent_0%,color-mix(in_oklch,var(--background)_55%,transparent)_80%,color-mix(in_oklch,var(--foreground)_60%,transparent)_100%)]"
            />
            <div className="absolute inset-x-3.5 bottom-3.5 rounded-2xl bg-card/95 px-4 py-3.5 shadow-[0_20px_40px_-24px_rgb(32_29_27/0.6)]">
              <div className="mb-2 flex items-center gap-2.5">
                <span className="gc-anim-spin-fast size-[18px] rounded-full border-2 border-foreground border-e-transparent" />
                <span role="status" className="text-sm font-bold">
                  {t.generatingTitle}
                </span>
              </div>
              <ol>
                {t.loadingSteps.map((label, index) => {
                  const stepDone = index < step;
                  const now = index === step;
                  return (
                    <li
                      key={label}
                      className={cn(
                        'flex h-[26px] items-center gap-2.5 text-[13px]',
                        stepDone || now ? 'text-foreground' : 'text-gc-inactive',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-4 items-center justify-center rounded-full border-[1.5px] border-current',
                          stepDone && 'bg-foreground',
                        )}
                      >
                        {stepDone ? <TickIcon size={10} strokeWidth={3} className="text-background" /> : null}
                      </span>
                      {label}
                    </li>
                  );
                })}
              </ol>
              <div className="mt-2.5 h-1 overflow-hidden rounded-sm bg-foreground/[0.12]">
                <div
                  className="h-full rounded-sm bg-foreground"
                  style={{ width: `${progress}%`, transition: 'width 0.8s linear' }}
                />
              </div>
            </div>
          </div>
        ) : null}

        {done && shownImage ? (
          <div className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={`${look.id}-${state.view}`}
              src={shownImage}
              alt={photoView ? (look.photo.kind === 'sample' ? t.pageSamplePhoto : t.photoLabel) : t.pagePieces[look.piece].name}
              className={cn(
                'absolute inset-0 size-full object-cover object-[50%_16%]',
                photoView ? 'gc-anim-swap' : 'gc-anim-reveal',
              )}
            />
            <span className="absolute start-3 top-3 inline-flex h-7 items-center gap-1.5 rounded-full bg-foreground/[0.82] px-[11px] text-xs font-bold text-background">
              <SparkleIcon size={13} />
              {photoView ? (look.photo.kind === 'sample' ? t.pageSamplePhoto : t.photoLabel) : t.pageStepLook}
            </span>
          </div>
        ) : null}

        {state.stage === 'failed' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <Silhouette className="h-[90px] w-[62px] text-gc-inactive lg:h-[110px] lg:w-[76px]" />
            <span className="flex items-center gap-2 text-base font-bold">
              <AlertIcon size={18} />
              {t.errorTitle}
            </span>
            <p role="alert" className="max-w-[320px] text-[13.5px] leading-normal text-muted-foreground">
              {failureMessage}
            </p>
            <button
              type="button"
              onClick={onRetry}
              disabled={retryLocked}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-[22px] text-[14.5px] font-bold text-background disabled:opacity-45"
            >
              <SparkleIcon size={17} />
              {t.tryAgain}
            </button>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={onUseSample}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-[13.5px] font-bold"
              >
                <SparkleIcon size={15} />
                {t.pageUseSample}
              </button>
              <a
                href={DEMO_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackClick('cta_clicked', { cta: 'open_store', section: 'try_on_result' })}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-[13.5px] font-bold"
              >
                <ShopifyMark monochrome decorative className="size-4" />
                {t.pageOpenStore}
                <ExtIcon size={14} strokeWidth={2} />
              </a>
            </div>
          </div>
        ) : null}
      </div>
      {done ? (
        <p className="mx-1.5 mb-1 mt-3 text-[12.5px] leading-normal text-muted-foreground">
          {look.source === 'sample' ? t.pageSampleCaption : t.noteText}
        </p>
      ) : null}
    </section>
  );
}

/* ─── Actions ─── */

export function ActionBar({
  t,
  state,
  look,
  canCompare,
  onCreate,
  onTryAnother,
  onCompare,
  tryAnotherRef,
  compareRef,
}: {
  t: TryOnTranslator;
  state: StudioState;
  look: Look | null;
  canCompare: boolean;
  onCreate: () => void;
  onTryAnother: () => void;
  onCompare: () => void;
  tryAnotherRef?: React.Ref<HTMLButtonElement>;
  compareRef?: React.Ref<HTMLButtonElement>;
}) {
  const secondary =
    'inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-border bg-card px-[18px] text-[14.5px] font-bold text-foreground hover:brightness-105 max-lg:w-full';
  return (
    <div className="flex min-h-16 items-center justify-center text-center">
      {state.stage === 'idle' ? (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <PhotoIcon size={16} />
          {t.pageNeedPhoto}
        </p>
      ) : null}
      {state.stage === 'ready' ? (
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex h-14 items-center justify-center gap-2.5 rounded-full bg-foreground px-[30px] text-base font-bold text-background shadow-[0_18px_36px_-18px_rgb(32_29_27/0.8)] hover:brightness-110 max-lg:w-full"
        >
          <SparkleIcon size={18} />
          {t.pageCreateLook}
        </button>
      ) : null}
      {state.stage === 'done' && look ? (
        <div className="flex w-full flex-col items-stretch gap-2.5 lg:w-auto lg:flex-row lg:flex-wrap lg:items-center lg:justify-center">
          <button
            ref={tryAnotherRef}
            type="button"
            onClick={onTryAnother}
            className="inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-foreground px-[22px] text-[14.5px] font-bold text-background hover:brightness-110 max-lg:w-full"
          >
            <HangerIcon size={17} strokeWidth={1.9} />
            {t.pageTryAnother}
          </button>
          {canCompare ? (
            <button ref={compareRef} type="button" onClick={onCompare} className={secondary}>
              <CompareIcon size={17} strokeWidth={1.9} />
              {t.pageCompareLooks}
            </button>
          ) : null}
          <a href={look.image} download={downloadName(look.image)} className={secondary}>
            <DownloadIcon size={17} strokeWidth={1.9} />
            {t.pageDownload}
          </a>
          <a
            href={DEMO_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackClick('cta_clicked', { cta: 'open_store', section: 'try_on_result' })}
            className="inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full px-[18px] text-[14.5px] font-bold text-foreground hover:bg-foreground/[0.06]"
          >
            {t.pageContinueShopping}
            <ExtIcon size={15} strokeWidth={2} />
          </a>
        </div>
      ) : null}
    </div>
  );
}

/* ─── Your looks ─── */

export function LooksTray({
  t,
  state,
  onShow,
}: {
  t: TryOnTranslator;
  state: StudioState;
  onShow: (id: number) => void;
}) {
  if (!state.looks.length) return null;
  const newestFirst = [...state.looks].reverse();
  return (
    <section
      aria-labelledby="tp-looks"
      className="mt-[22px] rounded-[22px] border border-secondary bg-card/70 px-4 py-3.5 lg:mt-7"
    >
      <div className="mb-2.5 flex items-center justify-between">
        <h2 id="tp-looks" className="text-sm font-bold">
          {t.pageLooksTitle}
        </h2>
        <span className="text-[12.5px] text-muted-foreground">{t.pageLooksCount(String(state.looks.length))}</span>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1">
        {newestFirst.map((look) => {
          const on = state.stage === 'done' && state.showing === look.id;
          const name = t.pagePieces[look.piece].name;
          return (
            <button
              key={look.id}
              type="button"
              aria-pressed={on}
              aria-label={name}
              onClick={() => onShow(look.id)}
              className="w-16 shrink-0 text-center lg:w-[72px]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={look.image}
                alt=""
                className={cn(
                  'block h-20 w-full rounded-[14px] border-2 object-cover object-[50%_15%] lg:h-[90px]',
                  on ? 'border-foreground' : 'border-transparent',
                )}
              />
              <span className="mt-[5px] block truncate text-[11px] font-semibold text-muted-foreground">{name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
