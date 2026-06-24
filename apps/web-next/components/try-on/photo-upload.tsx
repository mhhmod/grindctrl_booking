'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TRYON_FILE_CONFIG } from '@/lib/try-on/types';
import { useTryOnLocale } from './locale-provider';

interface PhotoUploadProps {
  onFileSelected: (file: File, dataUrl: string) => void;
  onFileClear: () => void;
  previewUrl: string | null;
  disabled?: boolean;
}

export function PhotoUpload({
  onFileSelected,
  onFileClear,
  previewUrl,
  disabled = false,
}: PhotoUploadProps) {
  const { t } = useTryOnLocale();
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);

      const allowedTypes = TRYON_FILE_CONFIG.allowedTypes as readonly string[];
      if (!allowedTypes.includes(file.type)) {
        setError(t.errUnsupported(TRYON_FILE_CONFIG.allowedExtensions.join(', ')));
        return;
      }
      if (file.size > TRYON_FILE_CONFIG.maxSizeBytes) {
        setError(t.errTooLarge(TRYON_FILE_CONFIG.maxSizeMB));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        onFileSelected(file, reader.result as string);
      };
      reader.readAsDataURL(file);
    },
    [onFileSelected, t],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so the same file can be re-selected
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleClear = () => {
    setError(null);
    onFileClear();
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">{t.photoLabel}</label>

      {previewUrl ? (
        /* ─── Preview state ─── */
        <div className="relative mx-auto w-full max-w-xs overflow-hidden rounded-xl border bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Your uploaded photo"
            className="aspect-[3/4] w-full object-cover"
          />
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute end-2 top-2 flex size-8 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-background"
              aria-label={t.removePhoto}
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      ) : (
        /* ─── Upload dropzone ─── */
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'group relative flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-all',
            'hover:border-primary/40 hover:bg-muted/40',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            isDragging && 'border-primary/60 bg-primary/5',
            disabled && 'pointer-events-none opacity-50',
          )}
          aria-label={t.uploadAria}
          id="photo-upload-dropzone"
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-muted/60 transition-colors group-hover:bg-muted">
            <Upload className="size-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {t.dropTitle}
            </p>
            <p className="text-xs text-muted-foreground">
              {t.dropHint(TRYON_FILE_CONFIG.maxSizeMB)}
            </p>
          </div>
        </button>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={TRYON_FILE_CONFIG.allowedTypes.join(',')}
        onChange={handleInputChange}
        className="hidden"
        aria-hidden="true"
        id="photo-upload-input"
      />

      {/* Error message */}
      {error && (
        <div
          className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
          id="photo-upload-error"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
