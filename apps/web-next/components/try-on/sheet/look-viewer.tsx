'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';

/* The look full screen (owner request, 2026-11-11): the sheet keeps the look
   small so its actions stay in view, so a tap opens it here to see it
   properly. Tap zooms to twice the size at that point and drag moves around;
   another tap fits it again. Look and Your photo switch in place. Escape, the
   close button or a swipe down (when not zoomed) closes it. */
export function LookViewer({
  lookSrc,
  photoSrc,
  initial,
  labels,
  onSave,
  onClose,
}: {
  lookSrc: string;
  photoSrc: string | null;
  initial: 'look' | 'photo';
  labels: { title: string; close: string; look: string; photo: string; save: string | null; lookAlt: string; photoAlt: string; zoomHint: string };
  onSave?: () => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<'look' | 'photo'>(photoSrc ? initial : 'look');
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const closeRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean; startY: number } | null>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  const src = view === 'look' ? lookSrc : photoSrc ?? lookSrc;

  return (
    <div role="dialog" aria-modal="true" aria-label={labels.title} className="fixed inset-0 z-50 flex flex-col bg-black text-white motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <div role="group" aria-label={labels.title} className="flex rounded-full bg-white/10 p-1 text-sm">
          {(['look', 'photo'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              disabled={option === 'photo' && !photoSrc}
              onClick={() => { setView(option); setZoom(null); setOffset({ x: 0, y: 0 }); }}
              className={`min-h-11 rounded-full px-4 font-medium focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40 ${view === option ? 'bg-white text-black' : 'text-white'}`}
            >
              {option === 'look' ? labels.look : labels.photo}
            </button>
          ))}
        </div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label={labels.close} className="grid size-11 place-items-center rounded-full bg-white/10 focus-visible:outline-2 focus-visible:outline-white">
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div
        className="relative min-h-0 flex-1 touch-none select-none overflow-hidden"
        onPointerDown={(event) => {
          drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y, moved: false, startY: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const d = drag.current;
          if (!d) return;
          const dx = event.clientX - d.x;
          const dy = event.clientY - d.y;
          if (Math.abs(dx) + Math.abs(dy) > 6) d.moved = true;
          if (zoom) setOffset({ x: d.ox + dx, y: d.oy + dy });
        }}
        onPointerUp={(event) => {
          const d = drag.current;
          drag.current = null;
          if (!d) return;
          // A swipe down closes when the look is not zoomed.
          if (!zoom && d.moved && event.clientY - d.startY > 90) { onClose(); return; }
          if (d.moved) return;
          if (zoom) { setZoom(null); setOffset({ x: 0, y: 0 }); return; }
          const box = event.currentTarget.getBoundingClientRect();
          setZoom({ x: ((event.clientX - box.left) / box.width) * 100, y: ((event.clientY - box.top) / box.height) * 100 });
        }}
      >
        {/* The look and the photo live in this page as data or blob URLs. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={view === 'look' ? labels.lookAlt : labels.photoAlt}
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain motion-safe:transition-transform motion-safe:duration-200"
          style={{
            transformOrigin: zoom ? `${zoom.x}% ${zoom.y}%` : 'center',
            transform: zoom ? `translate(${offset.x}px, ${offset.y}px) scale(2)` : 'none',
          }}
        />
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p className="text-xs text-white/70">{labels.zoomHint}</p>
        {onSave && labels.save && view === 'look' && (
          <button type="button" onClick={onSave} className="flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            <Download className="size-4" aria-hidden="true" />
            {labels.save}
          </button>
        )}
      </div>
    </div>
  );
}
