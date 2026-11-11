'use client';

import { createContext, useContext, useState, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import './scroll-shell.css';

const ActionTarget = createContext<HTMLDivElement | null>(null);

/** Pin existing inline actions when framed, preserving their handlers. */
export function ScrollShellAction({ children }: { children: ReactNode }) {
  const target = useContext(ActionTarget);
  return target ? createPortal(children, target) : children;
}

/* The shell every shopper-facing sheet and window state renders in: a
   pinned header, the single scrolling body, a pinned footer. Sized to the
   frame's dynamic viewport by default, which also stops the document behind
   it from scrolling (scroll-shell.css); `fill` sizes it to its parent
   instead, for a box someone else sizes. Nothing inside the body adds a
   scroll area of its own. */
export function ScrollShell({
  header,
  footer,
  overlay,
  children,
  fill = false,
  className,
  bodyClassName,
  footerClassName,
  bodyRef,
  bodyProps,
  actionSlot = false,
  ...rest
}: {
  header?: ReactNode;
  footer?: ReactNode;
  /** Fixed-position layers (a full-screen viewer), kept out of the scrolling body. */
  overlay?: ReactNode;
  children?: ReactNode;
  fill?: boolean;
  className?: string;
  bodyClassName?: string;
  footerClassName?: string;
  bodyRef?: Ref<HTMLDivElement>;
  bodyProps?: Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'children'>;
  actionSlot?: boolean;
} & Omit<HTMLAttributes<HTMLDivElement>, 'children'>) {
  const [actionTarget, setActionTarget] = useState<HTMLDivElement | null>(null);
  return (
    <ActionTarget.Provider value={actionTarget}>
    <div {...rest} className={cn('gc-shell', fill && 'gc-shell--fill', className)}>
      {header ? <div className="gc-shell__head">{header}</div> : null}
      <div {...bodyProps} ref={bodyRef} className={cn('gc-shell__body gc-scroll', bodyClassName)}>
        {children}
      </div>
      {footer ? <div className={cn('gc-shell__foot', footerClassName)}>{footer}</div> : null}
      {actionSlot && <div className={cn('gc-shell__foot gc-shell__slot', footerClassName)}><div ref={setActionTarget} className="gc-shell__actions" /></div>}
      {overlay}
    </div>
    </ActionTarget.Provider>
  );
}
