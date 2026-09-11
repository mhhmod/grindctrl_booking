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
   `data:` string stays plain text no matter who wrote it.

   The same discipline covers the small markdown subset below (**bold**,
   `inline code`, "- "/"* " bullet lines): every construct becomes a real
   React element (<strong>, <code>, a bullet marker span) with its content
   passed as a string child, so a raw string that happens to contain HTML
   stays inert text. Anything that does not cleanly match — an unmatched
   "**", a lone backtick — is left as plain text, never parsed further. */

// Stops at whitespace and at brackets/quotes, which are far more often the
// prose around a URL than part of one.
const URL_RE = /\bhttps?:\/\/[^\s<>()[\]{}"'`]+/gi;

// Trailing sentence punctuation is almost never part of the address.
const TRAILING_PUNCTUATION_RE = /[.,;:!?]+$/;

// One pass for both inline constructs, so bold and code can share a line
// without a second scan fighting the first over the same span. Deliberately
// narrow: no nesting, no empty markers, no multiline spans.
const INLINE_MD_RE = /\*\*([^*]+)\*\*|`([^`]+)`/g;

// A bullet is only a leading "- " or "* " (after optional indentation).
// Mid-line dashes and asterisks are prose, not list markers.
const BULLET_RE = /^\s*[-*] /;

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
  let key = 0;

  // Bold/code pass over a span the URL pass has already cleared: by the time
  // a string reaches here it contains no link, so this scan can never eat
  // one. Matched content goes in as a string child — React escapes it.
  function renderInline(segment: string): React.ReactNode[] {
    const out: React.ReactNode[] = [];
    let cursor = 0;

    for (const match of segment.matchAll(INLINE_MD_RE)) {
      const start = match.index ?? 0;
      if (start > cursor) out.push(segment.slice(cursor, start));

      if (match[0].startsWith('**')) {
        out.push(<strong key={`md-${key++}`}>{match[1]}</strong>);
      } else {
        out.push(
          <code key={`md-${key++}`} className="rounded bg-muted px-1 py-px font-mono text-[0.85em]">
            {match[2]}
          </code>,
        );
      }

      cursor = start + match[0].length;
    }

    if (cursor < segment.length) out.push(segment.slice(cursor));
    return out;
  }

  // The existing URL pass, unchanged in behavior: it owns link detection and
  // hands every non-link gap to renderInline for the bold/code scan.
  function renderLineContent(line: string): React.ReactNode[] {
    const out: React.ReactNode[] = [];
    let cursor = 0;

    for (const match of line.matchAll(URL_RE)) {
      const start = match.index ?? 0;
      const trailing = match[0].match(TRAILING_PUNCTUATION_RE);
      const raw = trailing ? match[0].slice(0, -trailing[0].length) : match[0];
      const href = raw ? safeHref(raw) : null;

      if (start > cursor) out.push(...renderInline(line.slice(cursor, start)));

      if (href) {
        out.push(
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
        out.push(...renderInline(raw));
      }

      cursor = start + raw.length;
    }

    if (cursor < line.length) out.push(...renderInline(line.slice(cursor)));
    return out;
  }

  // Split on "\n" and re-insert the newline between lines: the bubble already
  // carries whitespace-pre-wrap, so line breaks render exactly as before and
  // plain text with no markdown produces byte-identical output to the old
  // single-scan version.
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (index > 0) nodes.push('\n');

    const bullet = line.match(BULLET_RE);
    if (bullet) {
      nodes.push(
        <span key={`bullet-${key++}`}>
          <span aria-hidden="true">{'• '}</span>
          {renderLineContent(line.slice(bullet[0].length))}
        </span>,
      );
    } else {
      nodes.push(...renderLineContent(line));
    }
  });

  return <>{nodes}</>;
}
