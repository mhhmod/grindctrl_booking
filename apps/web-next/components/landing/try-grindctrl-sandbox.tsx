'use client';

import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  FileImage,
  FileUp,
  Lock,
  Mic,
  Network,
  RefreshCcw,
  Route,
  Sparkles,
} from 'lucide-react';
import type { LandingSandboxEnvelope, SandboxMode } from '@/lib/landing-sandbox/types';
import { buildMockSandboxEnvelope } from '@/lib/landing/mock-sandbox-runner';
import {
  LANDING_PREVIEW_HISTORY_KEY,
  LANDING_PREVIEW_LIMIT,
} from '@/lib/landing/trial-preview-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthGateModal, useAuthGate } from '@/components/landing/auth-gate-modal';
import { TrialPathCard } from '@/components/landing/trial-path-card';
import { UnlockWorkflowCard } from '@/components/landing/unlock-workflow-card';

type PlaygroundMode = 'workflow' | 'voice' | 'file';
type StageState = 'idle' | 'active' | 'complete' | 'locked';

const MAX_TEXT_CHARS = 500;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const STAGE_DELAY_MS = process.env.NODE_ENV === 'test' ? 1 : 420;
const LOCKED_ACTIONS = ['Save preview', 'Deploy workflow', 'Sync CRM/Sheets', 'Export report'];

const modeOptions: Array<{
  value: PlaygroundMode;
  label: string;
  description: string;
  sandboxMode: SandboxMode;
  icon: React.ComponentType<{ className?: string }>;
  samples: string[];
}> = [
  {
    value: 'workflow',
    label: 'Workflow Planner',
    description: 'Map a business process into route, owner, and action steps.',
    sandboxMode: 'text',
    icon: Network,
    samples: ['Support + lead routing', 'Missed call follow-up', 'File intake to CRM', 'Daily ops report'],
  },
  {
    value: 'voice',
    label: 'Voice Lead Capture',
    description: 'Turn a spoken lead into owner, priority, and handoff decision.',
    sandboxMode: 'voice',
    icon: Mic,
    samples: ['Dental clinic missed calls', 'Real estate buyer lead', 'Hotel booking request', 'Service quote request'],
  },
  {
    value: 'file',
    label: 'File/Image Intake',
    description: 'Extract routing signals from docs, screenshots, and attachments.',
    sandboxMode: 'image',
    icon: FileImage,
    samples: ['Invoice extraction', 'Damaged product image', 'Contract summary', 'Support attachment triage'],
  },
];

const stages = [
  { label: 'Read input', icon: FileUp },
  { label: 'Extract entities', icon: Sparkles },
  { label: 'Choose route', icon: Route },
  { label: 'Prepare action', icon: CheckCircle2 },
  { label: 'Unlock next step', icon: Lock },
];

function nowMs() {
  return Date.now();
}

function compactText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function readRunHistory(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LANDING_PREVIEW_HISTORY_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    const cutoff = nowMs() - 24 * 60 * 60 * 1000;
    return parsed.filter((entry) => typeof entry === 'number' && entry > cutoff);
  } catch {
    return [];
  }
}

function writeRunHistory(entries: number[]) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LANDING_PREVIEW_HISTORY_KEY, JSON.stringify(entries));
  }
}

function noteSuccessfulRun() {
  const next = [...readRunHistory(), nowMs()];
  writeRunHistory(next);
  return next.length;
}

function acceptForMode(mode: PlaygroundMode) {
  if (mode === 'voice') return 'audio/*';
  if (mode === 'file') return 'image/*,.txt,.csv,.json,.xml,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx';
  return undefined;
}

function stageState(index: number, activeStage: number, hasResult: boolean): StageState {
  if (hasResult) return index === stages.length - 1 ? 'locked' : 'complete';
  if (activeStage === index) return 'active';
  if (activeStage > index) return 'complete';
  return 'idle';
}

export function TryGrindctrlSandbox() {
  const [mode, setMode] = useState<PlaygroundMode>('workflow');
  const [prompt, setPrompt] = useState('');
  const [transcript, setTranscript] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeStage, setActiveStage] = useState(-1);
  const [resultEnvelope, setResultEnvelope] = useState<LandingSandboxEnvelope | null>(null);
  const [runCount, setRunCount] = useState(() => readRunHistory().length);
  const { gatedAction, triggerGate, closeGate } = useAuthGate();

  const selectedMode = modeOptions.find((option) => option.value === mode) ?? modeOptions[0];
  const remainingRuns = useMemo(() => Math.max(LANDING_PREVIEW_LIMIT - runCount, 0), [runCount]);
  const result = resultEnvelope?.result ?? null;

  function resetPreview(nextMode = mode) {
    setMode(nextMode);
    setPrompt('');
    setTranscript('');
    setFile(null);
    setError('');
    setActiveStage(-1);
    setResultEnvelope(null);
    setIsLoading(false);
  }

  function validateInputs() {
    const normalizedPrompt = compactText(prompt);
    const normalizedTranscript = compactText(transcript);
    if (normalizedPrompt.length > MAX_TEXT_CHARS || normalizedTranscript.length > MAX_TEXT_CHARS) {
      return 'Keep text inputs under 500 characters for this guided preview.';
    }
    if (file && file.size > MAX_FILE_BYTES) {
      return 'Use a file under 8 MB for this guided preview.';
    }
    if (mode === 'workflow' && !normalizedPrompt) return 'Describe a process first.';
    if (mode === 'voice' && !normalizedTranscript && !file) return 'Add a transcript or voice file preview.';
    if (mode === 'file' && !file && !normalizedPrompt) return 'Add a file or describe the intake context.';
    return null;
  }

  function runPreview() {
    setError('');
    const history = readRunHistory();
    if (history.length >= LANDING_PREVIEW_LIMIT) {
      setRunCount(history.length);
      setResultEnvelope(null);
      setError("You've completed today's guided previews.");
      return;
    }

    const validationError = validateInputs();
    if (validationError) {
      setResultEnvelope(null);
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setResultEnvelope(null);
    setActiveStage(0);

    stages.forEach((_, index) => {
      window.setTimeout(() => setActiveStage(index), index * STAGE_DELAY_MS);
    });

    window.setTimeout(() => {
      const envelope = buildMockSandboxEnvelope({
        mode: selectedMode.sandboxMode,
        prompt: compactText(prompt),
        transcript: compactText(transcript),
        fileName: file?.name,
      });
      setResultEnvelope(envelope);
      setRunCount(noteSuccessfulRun());
      setActiveStage(stages.length - 1);
      setIsLoading(false);
    }, stages.length * STAGE_DELAY_MS + (process.env.NODE_ENV === 'test' ? 1 : 180));
  }

  function applySample(sample: string) {
    if (mode === 'voice') setTranscript(sample);
    else setPrompt(sample);
  }

  return (
    <section id="try-grindctrl" className="relative overflow-hidden border-b border-white/10 bg-muted/10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_50%_0%,rgba(96,165,250,0.12),transparent_55%)]" />
      <div className="relative mx-auto w-full max-w-7xl px-4 py-[72px] sm:px-6 lg:px-8 lg:py-[104px]">
        <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <Badge variant="secondary" className="h-7 rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.18em]">
              Try the AI operations playground
            </Badge>
            <div className="space-y-3">
              <h2 className="text-[30px] font-bold leading-[1.1] tracking-normal sm:text-4xl lg:text-[44px] lg:leading-[1.05]">
                Preview how GrindCTRL turns inputs into business actions.
              </h2>
              <p className="max-w-2xl text-base leading-[1.65] text-muted-foreground sm:text-lg">
                Test guided workflows for support, leads, files, and routing before connecting your tools.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="h-7 w-fit rounded-full border-white/10 bg-white/[0.03] px-3 text-[11px]">
            3 guided previews included
          </Badge>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.36fr)_minmax(240px,0.24fr)_minmax(0,0.4fr)] lg:gap-6">
          <Card className="gc-card-hover min-h-[620px] rounded-3xl border-white/10 bg-card/70">
            <CardHeader className="p-5 pb-4 sm:p-6 sm:pb-4">
              <CardTitle className="text-lg">Input console</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 p-5 pt-0 sm:p-6 sm:pt-0">
              <div className="grid gap-2">
                {modeOptions.map((option) => {
                  const Icon = option.icon;
                  const isActive = option.value === mode;
                  return (
                    <Button
                      key={option.value}
                      type="button"
                      variant={isActive ? 'default' : 'outline'}
                      aria-pressed={isActive}
                      className={`h-11 justify-start rounded-xl px-3 text-[13px] font-semibold ${
                        isActive ? '' : 'border-white/10 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06]'
                      }`}
                      onClick={() => resetPreview(option.value)}
                    >
                      <Icon className="me-2 size-4" />
                      {option.label}
                    </Button>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-white/10 bg-background/70 p-4">
                {!result && !isLoading ? (
                  <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-[13px] leading-[1.55] text-muted-foreground">
                    <p className="font-semibold text-foreground">Try 3 guided previews before setup.</p>
                    <p className="mt-1">No tools connected yet.</p>
                    <p>No external actions are executed in preview.</p>
                  </div>
                ) : null}
                <div className="mb-4 space-y-1">
                  <p className="text-sm font-semibold">{selectedMode.label}</p>
                  <p className="text-[13px] leading-[1.55] text-muted-foreground">{selectedMode.description}</p>
                </div>

                {mode !== 'voice' ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="sandbox-prompt">
                      {mode === 'workflow' ? 'Process description' : 'Intake context'}
                    </label>
                    <textarea
                      id="sandbox-prompt"
                      className="min-h-32 w-full rounded-xl border border-white/10 bg-background/70 p-3 text-sm leading-[1.55] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      placeholder={mode === 'workflow' ? 'Describe a process you want AI to handle...' : 'Add context for this file or image intake...'}
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">{compactText(prompt).length}/{MAX_TEXT_CHARS} characters</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="sandbox-transcript">
                      Voice transcript
                    </label>
                    <textarea
                      id="sandbox-transcript"
                      className="min-h-32 w-full rounded-xl border border-white/10 bg-background/70 p-3 text-sm leading-[1.55] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      placeholder="Paste a short lead transcript or upload a voice file preview..."
                      value={transcript}
                      onChange={(event) => setTranscript(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">{compactText(transcript).length}/{MAX_TEXT_CHARS} characters</p>
                  </div>
                )}

                {mode !== 'workflow' ? (
                  <div className="mt-4 min-h-24 rounded-xl border border-dashed border-white/15 bg-white/[0.025] p-4">
                    <label className="text-[13px] font-medium" htmlFor="sandbox-file">
                      {mode === 'voice' ? 'Voice file preview' : 'Upload file or image'}
                    </label>
                    <input
                      id="sandbox-file"
                      type="file"
                      accept={acceptForMode(mode)}
                      className="mt-3 block w-full text-sm text-muted-foreground file:me-3 file:rounded-lg file:border file:border-white/10 file:bg-white/[0.04] file:px-3 file:py-2 file:text-foreground"
                      onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      {file ? `Loaded: ${file.name}` : 'Optional preview upload. No external action runs.'}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedMode.samples.map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
                    onClick={() => applySample(sample)}
                  >
                    {sample}
                  </button>
                ))}
              </div>

              {error ? (
                error.includes('completed') ? (
                  <UnlockWorkflowCard variant="completed" />
                ) : (
                  <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </p>
                )
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  className="h-12 flex-1 rounded-xl text-sm font-semibold"
                  disabled={isLoading}
                  onClick={runPreview}
                >
                  <Sparkles className="me-2 size-4" />
                  {isLoading ? 'Generating preview...' : 'Generate workflow preview'}
                </Button>
                <Button type="button" variant="outline" className="h-10 rounded-xl border-white/10 bg-white/[0.03]" onClick={() => resetPreview()}>
                  <RefreshCcw className="me-2 size-4" />
                  Reset preview
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="gc-card-hover rounded-3xl border-white/10 bg-white/[0.025]">
            <CardHeader className="p-5 pb-4">
              <CardTitle className="text-lg">Processing trail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5 pt-0">
              {stages.map((stage, index) => {
                const Icon = stage.icon;
                const state = stageState(index, activeStage, Boolean(result));
                return (
                  <div
                    key={stage.label}
                    className={`flex min-h-[72px] items-center gap-3 rounded-2xl border p-3.5 transition duration-300 ${
                      state === 'active'
                        ? 'border-primary/30 bg-primary/10 text-foreground'
                        : state === 'complete'
                          ? 'border-emerald-400/20 bg-emerald-400/5 text-emerald-200'
                          : state === 'locked'
                            ? 'border-amber-400/25 bg-amber-400/5 text-amber-200'
                            : 'border-white/10 bg-background/50 text-muted-foreground'
                    }`}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-current/15 bg-current/5">
                      <Icon className={`size-[18px] ${state === 'active' ? 'gc-pulse-glow' : ''}`} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{stage.label}</p>
                      <p className="mt-1 text-xs text-current/70">
                        {state === 'active' ? 'Running now' : state === 'complete' ? 'Complete' : state === 'locked' ? 'Ready to unlock' : 'Waiting'}
                      </p>
                    </div>
                    <span className={`size-2 rounded-full ${state === 'idle' ? 'bg-white/20' : 'bg-current'}`} />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="gc-card-hover min-h-[620px] rounded-3xl border-white/10 bg-card/70" data-testid="sandbox-result" aria-live="polite">
            <CardHeader className="p-5 pb-4 sm:p-6 sm:pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="size-5 text-primary" />
                Workflow preview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5 pt-0 sm:p-6 sm:pt-0">
              {!result ? (
                  <div className="grid gap-3">
                  {['Summary', 'Extracted entities', 'Decision route', 'Prepared actions'].map((label) => (
                    <div key={label} className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-4">
                      <p className="text-sm font-semibold">{label}</p>
                      <div className="mt-3 h-2 w-3/4 rounded-full bg-white/10" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="gc-result-reveal space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="rounded-full border-white/10 text-xs">
                      {result.workflowSlug}
                    </Badge>
                    <Badge variant="outline" className="rounded-full border-white/10 text-xs">
                      {result.status}
                    </Badge>
                    <Badge variant="secondary" className="rounded-full text-xs">
                      {result.confidence}% confidence
                    </Badge>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs text-muted-foreground">Summary</p>
                    <p className="mt-2 text-sm font-medium leading-6">{result.summary}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-xs text-muted-foreground">Decision route</p>
                      <p className="mt-1 text-sm font-semibold">{result.decision.route}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-xs text-muted-foreground">Priority</p>
                      <p className="mt-1 text-sm font-semibold capitalize">{result.decision.priority}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-xs text-muted-foreground">Handoff required</p>
                      <p className="mt-1 text-sm font-semibold">{result.decision.handoffRequired ? 'Yes' : 'No'}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="mb-3 text-xs text-muted-foreground">Extracted entities</p>
                    <dl className="grid gap-2">
                      {Object.entries(result.extractedEntities).map(([key, value]) => (
                        <div key={key} className="flex items-start justify-between gap-3 text-sm">
                          <dt className="text-muted-foreground">{key}</dt>
                          <dd className="max-w-[55%] break-words text-end font-medium">{String(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs text-muted-foreground">Prepared actions</p>
                    <p className="mt-2 text-sm font-medium">{result.recommendedAction}</p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Ready to unlock: Save, deploy, sync, and export.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {LOCKED_ACTIONS.map((action) => (
                        <button
                          key={action}
                          type="button"
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 text-xs text-amber-200 transition hover:bg-amber-400/10"
                          onClick={() => triggerGate(action)}
                        >
                          <Lock className="size-3.5" />
                          {action}
                        </button>
                      ))}
                    </div>
                  </div>

                  <UnlockWorkflowCard />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-6">
          <TrialPathCard />
        </div>
      </div>

      {gatedAction && <AuthGateModal actionLabel={gatedAction} onClose={closeGate} />}
    </section>
  );
}
