'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AuthGateModalProps {
  actionLabel: string;
  onClose: () => void;
}

export function AuthGateModal({ actionLabel, onClose }: AuthGateModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Unlock ${actionLabel}`}
    >
      <div className="gc-fade-in-up relative mx-4 w-full max-w-md rounded-3xl border border-white/10 bg-card/90 p-6 shadow-2xl shadow-black/40 backdrop-blur">
        <button
          onClick={onClose}
          className="absolute end-3 top-3 rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
          <Sparkles className="size-5 text-primary" />
        </div>

        <h3 className="text-lg font-semibold">
          Unlock the full workflow
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Continue with {actionLabel.toLowerCase()}, connect CRM, Sheets, and support tools,
          then save and deploy this workflow from your workspace.
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button asChild size="sm" className="h-11 w-full rounded-xl sm:w-auto">
            <Link href="/sign-up">
              Start 14-day trial
              <ArrowRight className="ms-1 size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-11 w-full rounded-xl border-white/10 bg-white/[0.03] sm:w-auto">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Hook to manage gate modal state */
export function useAuthGate() {
  const [gatedAction, setGatedAction] = useState<string | null>(null);

  const triggerGate = useCallback((action: string) => {
    setGatedAction(action);
  }, []);

  const closeGate = useCallback(() => {
    setGatedAction(null);
  }, []);

  return { gatedAction, triggerGate, closeGate };
}
