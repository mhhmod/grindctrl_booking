import React from 'react';
import { cn } from '@/lib/utils';

type FormFeedbackTone = 'success' | 'error' | null;

export function DashboardFormFeedback({
  isPending,
  pendingMessage,
  message,
  tone,
  className,
}: {
  isPending: boolean;
  pendingMessage: string;
  message: string | null;
  tone: FormFeedbackTone;
  className?: string;
}) {
  return (
    <div className={cn('min-h-6 text-sm', className)} role="status" aria-live="polite">
      {isPending ? <span className="text-muted-foreground">{pendingMessage}</span> : null}
      {!isPending && message ? (
        <span className={tone === 'error' ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}>{message}</span>
      ) : null}
    </div>
  );
}
