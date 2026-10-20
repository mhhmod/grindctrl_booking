'use client';

import { useRef, useState } from 'react';
import { Camera, ChevronRight, Image as ImageIcon, Lock, PersonStanding, Shirt, Sun } from 'lucide-react';
import { TRYON_FILE_CONFIG } from '@/lib/try-on/types';
import { photoFileError, readPhotoAsDataUrl } from '@/lib/try-on/photo-file';
import type { SheetCopy } from '@/lib/try-on/sheet-copy';
import type { TryOnTranslator } from '@/lib/try-on/i18n';

/* TryOn-Photo (02-try-on.md): the coaching tiles, then the ways to add a
   photo. Take a photo opens the phone's own camera; the in-sheet camera
   with the body outline, the timer and the camera switch comes later. The
   model path stays hidden until the owner decides where models come from
   (item 27). */
export function SheetPhotoStep({
  copy,
  t,
  lookSeconds,
  onPhoto,
  onShowPrivacy,
}: {
  copy: SheetCopy;
  t: TryOnTranslator;
  /** The store's measured time per look, or null when it has too few looks. */
  lookSeconds: number | null;
  onPhoto: (dataUrl: string) => void;
  onShowPrivacy: () => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const invalid = photoFileError(file, t);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    try {
      onPhoto(await readPhotoAsDataUrl(file));
    } catch {
      setError(t.genericError);
    }
  }

  const accept = TRYON_FILE_CONFIG.allowedTypes.join(',');
  const tips = [
    { icon: PersonStanding, label: copy.tipFullLength },
    { icon: Shirt, label: copy.tipHijab },
    { icon: Sun, label: copy.tipLight },
  ];

  return (
    <div className="flex min-h-full flex-col gap-5">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{copy.photoTitle}</h2>
        <p className="text-base leading-relaxed text-muted-foreground">
          {copy.photoIntro}
          {lookSeconds !== null && <> {copy.photoTime(lookSeconds)}</>}
        </p>
      </div>

      <ul className="grid grid-cols-3 gap-2">
        {tips.map(({ icon: Icon, label }) => (
          <li key={label} className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 px-2 py-3 text-center text-xs font-medium text-foreground">
            <Icon className="size-6" aria-hidden="true" />
            <span>{label}</span>
          </li>
        ))}
      </ul>

      <div className="space-y-3">
        <ChoiceButton
          icon={<Camera className="size-5" aria-hidden="true" />}
          primary
          title={copy.takePhoto}
          hint={copy.takePhotoHint}
          onClick={() => cameraRef.current?.click()}
        />
        <ChoiceButton
          icon={<ImageIcon className="size-5" aria-hidden="true" />}
          title={copy.choosePhoto}
          hint={copy.choosePhotoHint}
          onClick={() => galleryRef.current?.click()}
        />
        <input ref={cameraRef} type="file" accept={accept} capture="user" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={handle} />
        <input ref={galleryRef} type="file" accept={accept} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={handle} />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <p className="mt-auto flex gap-3 border-t pt-4 text-sm leading-relaxed text-muted-foreground">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          {copy.lockLine}{' '}
          <button type="button" onClick={onShowPrivacy} className="font-medium text-foreground underline underline-offset-2">
            {copy.howPhotosHandled}
          </button>
        </span>
      </p>
    </div>
  );
}

function ChoiceButton({
  icon,
  title,
  hint,
  primary = false,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-start transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span
        className={`grid size-12 shrink-0 place-items-center rounded-xl ${primary ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-foreground">{title}</span>
        <span className="block text-sm text-muted-foreground">{hint}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground rtl:-scale-x-100" aria-hidden="true" />
    </button>
  );
}
