'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { ScrollShell } from '@/components/embed/scroll-shell';
import { X } from 'lucide-react';

/* What the sheet puts around every step: the product row it pins at the top,
   and a notice (the session error) that leads the body. A step rendered on
   its own, as in its tests, has neither. */
const SheetChromeContext = createContext<{ header: ReactNode; notice: ReactNode; closeLabel: string }>({ header: null, notice: null, closeLabel: 'Close' });

export function SheetChrome({ header, notice, children, closeLabel }: { header: ReactNode; notice: ReactNode; children: ReactNode; closeLabel: string }) {
  return <SheetChromeContext.Provider value={{ header, notice, closeLabel }}>{children}</SheetChromeContext.Provider>;
}

/** A step's place in the sheet's shell: the pinned header (the sheet's own
 *  unless the step brings one), the step's content as the one scrolling
 *  body, and its primary action pinned in the footer. */
export function SheetLayout({
  header,
  footer,
  overlay,
  wide = false,
  children,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  overlay?: ReactNode;
  /** The result beside its details on a wide frame. */
  wide?: boolean;
  children?: ReactNode;
}) {
  const chrome = useContext(SheetChromeContext);
  const head = header === undefined ? chrome.header : header;
  // Under 480px of height (`short`, a phone on its side) the rows tighten so
  // the body keeps room to scroll; the footer stays pinned either way.
  const column = `mx-auto w-full px-4 sm:px-8 ${wide ? 'max-w-4xl' : 'max-w-xl'}`;
  return (
    <ScrollShell
      header={head ? <div className={`${column} flex items-center gap-2 pt-2 pb-3 short:pb-2`}><div className="min-w-0 flex-1">{head}</div><SheetClose label={chrome.closeLabel} /></div> : null}
      footer={footer ? <div className={`${column} pt-3 short:pt-2`}>{footer}</div> : null}
      footerClassName="bg-background"
      overlay={overlay}
    >
      <div className={`${column} flex min-h-full flex-col gap-5 pt-1 pb-6 short:gap-4 short:pb-4`}>
        {chrome.notice}
        {children}
      </div>
    </ScrollShell>
  );
}

function SheetClose({ label }: { label: string }) {
  return <button type="button" data-sheet-close aria-label={label}
    onClick={() => window.parent.postMessage({ type: 'grindctrl-tryon:close' }, '*')}
    className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring">
    <X className="size-5" aria-hidden="true" />
  </button>;
}
