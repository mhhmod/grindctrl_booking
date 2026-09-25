/* Icons the phone AI operations steps reference by id (<use href="#gc-i-chat">),
   drawn once for the page. Same paths as components/site/icons.tsx. */

import { D_SHOPIFY } from './story-marks';

export function StorySprites() {
  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute size-0 overflow-hidden">
      <defs>
        <symbol id="gc-i-sparkle" viewBox="0 0 24 24"><path d="M12 3c.6 4.2 3.1 6.7 7.3 7.3-4.2.6-6.7 3.1-7.3 7.3-.6-4.2-3.1-6.7-7.3-7.3C8.9 9.7 11.4 7.2 12 3z" /></symbol>
        <symbol id="gc-i-chat" viewBox="0 0 24 24"><path d="M5 5.5h14a1.5 1.5 0 011.5 1.5v8.5A1.5 1.5 0 0119 17H10l-4.5 3.5V17H5a1.5 1.5 0 01-1.5-1.5V7A1.5 1.5 0 015 5.5z" /></symbol>
        <symbol id="gc-i-book" viewBox="0 0 24 24">
          <path d="M5 4.5h9.5a3 3 0 013 3v12H8a3 3 0 01-3-3v-12z" />
          <path d="M5 16.5a3 3 0 013-3h9.5" />
        </symbol>
        <symbol id="gc-i-photo" viewBox="0 0 24 24">
          <rect x="3.5" y="5" width="17" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.6" />
          <path d="M20.5 15.5l-5-5-9 8.5" />
        </symbol>
        <symbol id="gc-i-reply" viewBox="0 0 24 24">
          <path d="M9.5 8L5 12l4.5 4" />
          <path d="M5 12h9a5 5 0 015 5v1" />
        </symbol>
        <symbol id="gc-i-handoff" viewBox="0 0 24 24">
          <path d="M3.5 12h8" />
          <path d="M8.5 8.5L12 12l-3.5 3.5" />
          <circle cx="17.5" cy="9" r="2.6" />
          <path d="M13.8 19.5c.5-2.6 2-3.9 3.7-3.9s3.2 1.3 3.7 3.9" />
        </symbol>
        <symbol id="gc-i-check" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M8.5 12.2l2.4 2.4 4.8-5" />
        </symbol>
        <symbol id="gc-i-inbox" viewBox="0 0 24 24">
          <path d="M4 13l2.2-7.2A1.5 1.5 0 017.6 4.7h8.8a1.5 1.5 0 011.4 1.1L20 13v5.5a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 18.5V13z" />
          <path d="M4 13h4.5l1.5 2.5h4l1.5-2.5H20" />
        </symbol>
        <symbol id="gc-l-shopify" viewBox="0 0 24 24"><path d={D_SHOPIFY} /></symbol>
      </defs>
    </svg>
  );
}
