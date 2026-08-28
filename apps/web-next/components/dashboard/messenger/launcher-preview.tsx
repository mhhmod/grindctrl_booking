'use client';

import React from 'react';
import type { PublicMessengerPayload } from '@/lib/messenger/public-api';
import type { MessengerLocale } from '@/lib/messenger/types';

/* The closed-state launcher, as the shopper sees it.
 *
 * The shipped launcher is vanilla JS inside a shadow root
 * (public/widget/v1/messenger.js) so it cannot be imported here. This is a
 * deliberate mirror of that file's visual contract — pill with a label,
 * circle without, accent background, 20px from the corner. If the launcher
 * CSS there changes, change it here too; the panel below is the real
 * component and needs no such care. */

const ICON_PATHS: Record<string, string> = {
  chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  message:
    'M21 11.5a8.38 8.38 0 0 1-.9 3.8A8.5 8.5 0 0 1 12.5 20a8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z',
};

function safeColor(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#2a2826';
}

export function LauncherPreview({
  payload,
  locale,
  onClick,
  expanded,
}: {
  payload: PublicMessengerPayload;
  locale: MessengerLocale;
  onClick: () => void;
  expanded: boolean;
}) {
  const { appearance } = payload;
  const label =
    locale === 'ar'
      ? appearance.launcherLabel?.ar || appearance.launcherLabel?.en || ''
      : appearance.launcherLabel?.en || appearance.launcherLabel?.ar || '';
  const iconOnly = !label;
  const accent = safeColor(appearance.accentColor);
  const size = Math.min(Math.max(appearance.launcherSizePx ?? 56, 44), 72);
  const left = appearance.position === 'bottom-left';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-label={label || (locale === 'ar' ? 'الدعم' : 'Support')}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      style={{
        background: accent,
        [left ? 'left' : 'right']: 20,
        bottom: 20,
        height: iconOnly ? size : 48,
        width: iconOnly ? size : undefined,
        borderRadius: 999,
      }}
      className={`absolute z-10 flex items-center justify-center gap-2 text-sm font-semibold text-white shadow-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 motion-reduce:transition-none ${
        iconOnly ? '' : 'px-[18px]'
      }`}
    >
      {appearance.launcherCustomIconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- merchant-supplied absolute URL, mirrors the storefront loader
        <img
          src={appearance.launcherCustomIconUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="size-[26px] rounded-full object-cover"
        />
      ) : (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {appearance.launcherIcon === 'help' ? (
            <>
              <circle cx="12" cy="12" r="9" />
              <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.4-3 4" />
              <circle cx="12" cy="17.2" r=".6" fill="currentColor" />
            </>
          ) : (
            <path d={ICON_PATHS[appearance.launcherIcon] ?? ICON_PATHS.chat} />
          )}
        </svg>
      )}
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}
