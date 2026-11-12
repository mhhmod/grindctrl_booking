'use client';

import * as React from 'react';
import classes from './notice.module.css';

/* Copy marks a Latin value (a store's host) with U+2068..U+2069. Chrome
   loses that isolate where a long host wraps in Arabic ("-maison" on the
   first line), so the value is drawn as its own left-to-right element. */
function isolated(text: string): React.ReactNode {
  const parts = text.split(/⁨([^⁩]*)⁩/);
  if (parts.length === 1) return text;
  return parts.map((part, i) => (i % 2 ? <bdi key={i} dir="ltr" className={classes.value}>{part}</bdi> : part));
}

/* The one card the dashboard uses for a state that is not a page's own
   content (04-dashboard.md). `role="alert"` when something failed. */
export function V16Notice({
  title,
  body,
  role,
  children,
}: {
  title: string;
  body: string;
  role?: 'alert';
  children?: React.ReactNode;
}) {
  const id = React.useId();
  return (
    <section className={classes.notice} aria-labelledby={id}>
      <h2 id={id} className={classes.title}>
        {isolated(title)}
      </h2>
      <p className={classes.body} role={role}>
        {body}
      </p>
      {children && <div className={classes.actions}>{children}</div>}
    </section>
  );
}

/** A group of actions inside a notice, separated from the one before it. */
export function V16NoticeGroup({ hint, children }: { hint?: string; children: React.ReactNode }) {
  return (
    <div className={classes.group}>
      {hint && <p className={classes.hint}>{hint}</p>}
      <div className={classes.row}>{children}</div>
    </div>
  );
}

/** A small line under a notice's actions, such as the error reference. */
export function V16NoticeNote({ children }: { children: React.ReactNode }) {
  return <p className={classes.note}>{children}</p>;
}
