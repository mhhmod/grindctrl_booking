'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Square,
  Upload,
} from 'lucide-react';
import type { LandingSandboxEnvelope, SandboxMode } from '@/lib/landing-sandbox/types';
import {
  LANDING_PREVIEW_HISTORY_KEY,
  LANDING_PREVIEW_LIMIT,
} from '@/lib/landing/trial-preview-state';
import { runLandingSandbox } from '@/lib/landing-sandbox/client';
import { saveLandingPreviewHandoff } from '@/lib/trial/landing-preview-handoff';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AuthGateModal, useAuthGate } from '@/components/landing/auth-gate-modal';
import { TrialPathCard } from '@/components/landing/trial-path-card';
import { UnlockWorkflowCard } from '@/components/landing/unlock-workflow-card';

type PlaygroundMode = 'workflow' | 'voice' | 'file';
type StageState = 'idle' | 'active' | 'complete' | 'locked';
type RecordingState = 'idle' | 'recording';

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
    sandboxMode: 'workflow',
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
    sandboxMode: 'file',
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

function labelForEntity(key: string) {
  return key.replace(/_/g, ' ');
}

function sourceLabel(envelope: LandingSandboxEnvelope | null) {
  if (!envelope) return 'Ready';
  if (envelope.meta.runtime === 'live') return 'Workflow response';
  if (envelope.meta.runtime === 'fallback' || envelope.fallback) return 'Fallback preview';
  return 'Local preview';
}

export function TryGrindctrlSandbox() {
  const [mode, setMode] = useState<PlaygroundMode>('workflow');
  const [prompt, setPrompt] = useState('');
  const [transcript, setTranscript] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [activeStage, setActiveStage] = useState(-1);
  const [resultEnvelope, setResultEnvelope] = useState<LandingSandboxEnvelope | null>(null);
  const [runCount, setRunCount] = useState(() => readRunHistory().length);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const { gatedAction, triggerGate, closeGate } = useAuthGate();

  const selectedMode = modeOptions.find((option) => option.value === mode) ?? modeOptions[0];
  const remainingRuns = useMemo(() => Math.max(LANDING_PREVIEW_LIMIT - runCount, 0), [runCount]);
  const result = resultEnvelope?.result ?? null;
  const visibleEntities = useMemo(
    () => Object.entries(result?.extractedEntities ?? {}).filter(([, value]) => value !== null && String(value).trim()).slice(0, 6),
    [result],
  );
  const responseSourceLabel = sourceLabel(resultEnvelope);
  const inputLabel = mode === 'voice' ? 'Voice transcript' : mode === 'workflow' ? 'Process description' : 'Intake context';
  const inputValue = mode === 'voice' ? transcript : prompt;
  const inputLength = compactText(inputValue).length;

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function resetPreview(nextMode = mode) {
    stopVoiceRecording();
    setMode(nextMode);
    setPrompt('');
    setTranscript('');
    setFile(null);
    setError('');
    setActiveStage(-1);
    setResultEnvelope(null);
    setIsLoading(false);
  }

  function stopVoiceRecording() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    setRecordingState('idle');
  }

  async function startVoiceRecording() {
    setError('');
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice recording is not available in this browser. Upload an audio file instead.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const voiceFile = new File([blob], `voice-preview-${Date.now()}.webm`, { type: blob.type || 'audio/webm' });
        setFile(voiceFile);
        setTranscript((current) => current || 'Recorded voice preview ready for guided routing.');
        stream.getTracks().forEach((track) => track.stop());
        setRecordingState('idle');
      };

      recorder.start();
      setFile(null);
      setRecordingState('recording');
    } catch {
      setRecordingState('idle');
      setError('Microphone access was blocked. Upload an audio file or paste a transcript.');
    }
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

    window.setTimeout(async () => {
      try {
        const envelope = await runLandingSandbox({
          mode: selectedMode.sandboxMode,
          prompt: compactText(prompt),
          transcript: compactText(transcript),
          fileName: file?.name,
          locale: 'en',
          source: 'landing_sandbox',
        });

        if (envelope.ok && envelope.result.status !== 'failed') {
          saveLandingPreviewHandoff({
            source: 'landing_sandbox',
            mode: envelope.meta.mode,
            workflowSlug: envelope.result.workflowSlug,
            summary: envelope.result.summary,
            confidence: envelope.result.confidence,
            extractedEntities: envelope.result.extractedEntities,
            decision: envelope.result.decision,
            recommendedAction: envelope.result.recommendedAction,
          });
        }

        setResultEnvelope(envelope);
        setRunCount(noteSuccessfulRun());
        setActiveStage(stages.length - 1);
      } catch {
        setResultEnvelope(null);
        setError('Preview mode is not available right now.');
      } finally {
        setIsLoading(false);
      }
    }, stages.length * STAGE_DELAY_MS + (process.env.NODE_ENV === 'test' ? 1 : 180));
  }

  function applySample(sample: string) {
    if (mode === 'voice') setTranscript(sample);
    else setPrompt(sample);
  }

  return (
    <section id="try-grindctrl" className="relative overflow-hidden bg-background">
      <div className="relative mx-auto w-full max-w-7xl px-4 pb-[72px] pt-14 sm:px-6 sm:pt-16 lg:px-8 lg:pb-[104px] lg:pt-20">
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
          <Badge variant="outline" className="gc-landing-subtle h-7 w-fit rounded-full border px-3 text-[11px]">
            3 guided previews included
          </Badge>
        </div>

        <div className="mx-auto grid max-w-5xl gap-4">
          <Card className="gc-landing-card rounded-[2rem] border">
            <CardContent className="p-4 sm:p-5">
              <div className="grid gap-2 sm:grid-cols-3">
                {modeOptions.map((option) => {
                  const Icon = option.icon;
                  const isActive = option.value === mode;
                  return (
                    <Button
                      key={option.value}
                      type="button"
                      variant={isActive ? 'default' : 'outline'}
                      aria-pressed={isActive}
                      className={`h-11 justify-start rounded-2xl px-3 text-[13px] font-semibold ${
                        isActive ? '' : 'border-border bg-card/70 text-muted-foreground hover:bg-muted/80 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]'
                      }`}
                      onClick={() => resetPreview(option.value)}
                    >
                      <Icon className="me-2 size-4" />
                      {option.label}
                    </Button>
                  );
                })}
              </div>

              <div className="mt-4 rounded-[1.75rem] border border-border bg-background/75 p-3 shadow-inner shadow-black/5 dark:border-white/10 dark:bg-background/60">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <label className="text-sm font-semibold" htmlFor={mode === 'voice' ? 'sandbox-transcript' : 'sandbox-prompt'}>
                      {inputLabel}
                    </label>
                    <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{selectedMode.description}</p>
                  </div>
                  <Badge variant="outline" className="gc-landing-subtle rounded-full border text-[11px]">
                    {remainingRuns} previews left
                  </Badge>
                </div>

                {mode === 'voice' ? (
                  <textarea
                    id="sandbox-transcript"
                    className="min-h-28 w-full resize-y rounded-2xl border border-input bg-muted/20 p-3 text-base leading-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-white/10 dark:bg-white/[0.025]"
                    placeholder="Paste a short lead transcript or upload a voice file preview..."
                    value={transcript}
                    onChange={(event) => setTranscript(event.target.value)}
                  />
                ) : (
                  <textarea
                    id="sandbox-prompt"
                    className="min-h-28 w-full resize-y rounded-2xl border border-input bg-muted/20 p-3 text-base leading-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-white/10 dark:bg-white/[0.025]"
                    placeholder={mode === 'workflow' ? 'Describe a process you want AI to handle...' : 'Add context for this file or image intake...'}
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                  />
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{inputLength}/{MAX_TEXT_CHARS} characters</span>
                  <span>No external actions run in preview.</span>
                </div>

                {mode === 'voice' ? (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 rounded-2xl border-border bg-card/80 dark:border-white/10 dark:bg-white/[0.03]"
                      onClick={recordingState === 'recording' ? stopVoiceRecording : startVoiceRecording}
                    >
                      {recordingState === 'recording' ? <Square className="me-2 size-4 fill-current" /> : <Mic className="me-2 size-4" />}
                      {recordingState === 'recording' ? 'Stop recording' : 'Record voice'}
                    </Button>
                    <Button asChild type="button" variant="outline" className="h-10 rounded-2xl border-border bg-card/80 dark:border-white/10 dark:bg-white/[0.03]">
                      <label htmlFor="sandbox-voice-file" className="cursor-pointer">
                        <Upload className="me-2 size-4" />
                        Upload audio
                      </label>
                    </Button>
                    <input
                      id="sandbox-voice-file"
                      type="file"
                      accept="audio/*"
                      className="sr-only"
                      aria-label="Upload voice file"
                      onChange={(event) => {
                        setFile(event.target.files?.[0] ?? null);
                        setTranscript((current) => current || 'Uploaded voice preview ready for guided routing.');
                      }}
                    />
                    <span className="text-xs text-muted-foreground">{file ? `Loaded: ${file.name}` : 'No audio yet'}</span>
                  </div>
                ) : mode === 'file' ? (
                  <div className="mt-3 rounded-2xl border border-dashed border-border bg-muted/25 p-3 dark:border-white/15 dark:bg-white/[0.025]">
                    <label className="text-[13px] font-medium" htmlFor="sandbox-file">
                      Upload file or image
                    </label>
                    <input
                      id="sandbox-file"
                      type="file"
                      accept={acceptForMode(mode)}
                      className="mt-2 block w-full text-sm text-muted-foreground file:me-3 file:rounded-xl file:border file:border-border file:bg-card file:px-3 file:py-2 file:text-foreground dark:file:border-white/10 dark:file:bg-white/[0.04]"
                      onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">{file ? `Loaded: ${file.name}` : 'Optional preview upload.'}</p>
                  </div>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {selectedMode.samples.map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    className="rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-muted/80 hover:text-foreground dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
                    onClick={() => applySample(sample)}
                  >
                    {sample}
                  </button>
                ))}
              </div>

              {error ? (
                <div className="mt-3">
                  {error.includes('completed') ? (
                    <UnlockWorkflowCard variant="completed" />
                  ) : (
                    <p className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                      {error}
                    </p>
                  )}
                </div>
              ) : null}

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button type="button" className="h-12 flex-1 rounded-2xl text-sm font-semibold" disabled={isLoading} onClick={runPreview}>
                  <Sparkles className="me-2 size-4" />
                  {isLoading ? 'Generating preview...' : 'Generate workflow preview'}
                </Button>
                <Button type="button" variant="outline" className="h-12 rounded-2xl border-border bg-card/80 dark:border-white/10 dark:bg-white/[0.03]" onClick={() => resetPreview()}>
                  <RefreshCcw className="me-2 size-4" />
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="gc-landing-subtle rounded-2xl border p-3" role="status" aria-label="Processing trail">
            <div className="grid gap-2 sm:grid-cols-5">
              {stages.map((stage, index) => {
                const Icon = stage.icon;
                const state = stageState(index, activeStage, Boolean(result));
                return (
                  <div
                    key={stage.label}
                    className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 py-2 text-xs transition duration-300 ${
                      state === 'active'
                        ? 'border-primary/30 bg-primary/10 text-foreground'
                        : state === 'complete'
                          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                          : state === 'locked'
                            ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200'
                            : 'border-border bg-background/60 text-muted-foreground dark:border-white/10 dark:bg-background/40'
                    }`}
                  >
                    <Icon className={`size-4 shrink-0 ${state === 'active' ? 'gc-pulse-glow' : ''}`} />
                    <span className="min-w-0 truncate font-medium">{stage.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <Card className="gc-landing-card rounded-[2rem] border" data-testid="sandbox-result" aria-live="polite">
            <CardContent className="p-4 sm:p-5">
              {!result ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  {['Answer', 'Decision', 'Proof'].map((label) => (
                    <div key={label} className="rounded-2xl border border-dashed border-border bg-muted/30 p-4 dark:border-white/10 dark:bg-white/[0.025]">
                      <p className="text-sm font-semibold">{label}</p>
                      <div className="mt-3 h-2 w-3/4 rounded-full bg-muted dark:bg-white/10" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="gc-result-reveal space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={resultEnvelope?.meta.runtime === 'live' ? 'secondary' : 'outline'} className="rounded-full text-xs">
                      {responseSourceLabel}
                    </Badge>
                    <Badge variant="outline" className="rounded-full border-border text-xs dark:border-white/10">
                      {result.status}
                    </Badge>
                    <Badge variant="outline" className="rounded-full border-border text-xs dark:border-white/10">
                      {result.workflowSlug}
                    </Badge>
                    <Badge variant="secondary" className="rounded-full text-xs">
                      {result.confidence}% confidence
                    </Badge>
                  </div>

                  <div className="rounded-[1.5rem] border border-border bg-background/70 p-4 dark:border-white/10 dark:bg-white/[0.025]">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Answer</p>
                    <p className="mt-3 text-base font-medium leading-7 sm:text-lg">{result.summary}</p>
                    <p className="mt-3 text-sm text-muted-foreground">{resultEnvelope?.message}</p>
                    {resultEnvelope?.meta.requestId ? (
                      <p className="mt-2 text-xs text-muted-foreground">Workflow request: {resultEnvelope.meta.requestId}</p>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="gc-landing-subtle rounded-2xl border p-3">
                      <p className="text-xs text-muted-foreground">Route</p>
                      <p className="mt-1 truncate text-sm font-semibold">{result.decision.route}</p>
                    </div>
                    <div className="gc-landing-subtle rounded-2xl border p-3">
                      <p className="text-xs text-muted-foreground">Priority</p>
                      <p className="mt-1 text-sm font-semibold capitalize">{result.decision.priority}</p>
                    </div>
                    <div className="gc-landing-subtle rounded-2xl border p-3">
                      <p className="text-xs text-muted-foreground">Handoff</p>
                      <p className="mt-1 text-sm font-semibold">{result.decision.handoffRequired ? 'Needed' : 'Not needed'}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.75fr)]">
                    <div className="gc-landing-subtle rounded-2xl border p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Signals found</p>
                      {visibleEntities.length ? (
                        <dl className="grid gap-2">
                          {visibleEntities.map(([key, value]) => (
                            <div key={key} className="flex items-start justify-between gap-3 text-sm">
                              <dt className="capitalize text-muted-foreground">{labelForEntity(key)}</dt>
                              <dd className="max-w-[58%] break-words text-end font-medium">{String(value)}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : (
                        <p className="text-sm text-muted-foreground">No extra fields returned.</p>
                      )}
                    </div>

                    <div className="gc-landing-subtle rounded-2xl border p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Next step</p>
                      <p className="mt-3 text-sm font-medium leading-6">{result.recommendedAction}</p>
                      <p className="mt-3 text-xs text-muted-foreground">Ready to unlock: Save, deploy, sync, and export.</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {LOCKED_ACTIONS.map((action) => (
                          <button
                            key={action}
                            type="button"
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 text-xs text-amber-700 transition hover:bg-amber-500/15 dark:border-amber-400/20 dark:bg-amber-400/5 dark:text-amber-200 dark:hover:bg-amber-400/10"
                            onClick={() => triggerGate(action)}
                          >
                            <Lock className="size-3.5" />
                            {action}
                          </button>
                        ))}
                      </div>
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
