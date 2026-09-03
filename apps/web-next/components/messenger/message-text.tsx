import React from 'react';

/* Message bodies were rendered as a bare text node: `{m.content}`.

   Two things followed from that, and both are visible the moment an answer
   contains links. HTML collapses newlines, so a reply the model wrote as a
   list arrived as one unbroken paragraph — "our collections: - All Tees:
   https://... - Graphic Tees: https://..." — and the URLs were inert text a
   shopper could only select and copy by hand. The one thing a shopper wants
   from "give me the links" is to click one.

   Links are built as React nodes, never through dangerouslySetInnerHTML:
   this text comes from the model and, in the merchant's inbox, from
   shoppers. Only http and https become anchors, so a `javascript:` or
   `data:` string stays plain text no matter who wrote it. */

// Stops at whitespace and at brackets/quotes, which are far more often the
// prose around a URL than part of one.
const URL_RE = /\bhttps?:\/\/[^\s<>()[\]{}"'`]+/gi;

// Trailing sentence punctuation is almost never part of the address.
const TRAILING_PUNCTUATION_RE = /[.,;:!?]+$/;

function safeHref(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function MessageText({ text }: { text: string }) {
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    const trailing = match[0].match(TRAILING_PUNCTUATION_RE);
    const raw = trailing ? match[0].slice(0, -trailing[0].length) : match[0];
    const href = raw ? safeHref(raw) : null;

    if (start > cursor) nodes.push(text.slice(cursor, start));

    if (href) {
      nodes.push(
        <a
          key={`link-${key++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          /* break-all because a collection URL is longer than the bubble and
             has no spaces to break on; without it the bubble is forced wider
             than the panel. dir="ltr" keeps a URL readable inside an Arabic
             message, where it would otherwise be reordered. */
          className="break-all underline underline-offset-2"
          dir="ltr"
        >
          {raw}
        </a>,
      );
    } else if (raw) {
      nodes.push(raw);
    }

    cursor = start + raw.length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));

  return <>{nodes}</>;
}
