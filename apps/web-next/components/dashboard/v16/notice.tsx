'use client';

import * as React from 'react';
import classes from './notice.module.css';

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
        {title}
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
