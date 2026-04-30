'use client';

import Link from 'next/link';
import React, { useMemo, useState } from 'react';
import { ArrowRight, FileUp, Mic, Network, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type SandboxMode = 'workflow' | 'voice' | 'file';

interface SandboxResult {
  status: 'completed';
  summary: string;
  confidence: number;
  extractedEntities: Record<string, string | number>;
  recommendedAction: string;
  lockedActions: string[];
}

const STORAGE_KEY = 'gc-landing-sandbox-runs-v1';
const MAX_RUNS_PER_DAY = 3;
const VOICE_CHAR_LIMIT = 320;
const LOCKED_ACTIONS = ['Save blueprint', 'Deploy workflow', 'Sync CRM/Sheets', 'Export report'];

function nowMs() {
  return Date.now();
}

function readRunHistory(): number[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const cutoff = nowMs() - 24 * 60 * 60 * 1000;
    return parsed.filter((entry) => typeof entry === 'number' && entry > cutoff);
  } catch {
    return [];
  }
}

function writeRunHistory(entries: number[]) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function compactText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function buildWorkflowResult(input: string): SandboxResult {
  const tokens = compactText(input).split(' ').filter(Boolean);
  const dominantGoal = tokens.slice(0, 8).join(' ') || 'Support and lead routing';
  const integration = /crm|hubspot|salesforce/i.test(input)
    ? 'CRM'
    : /sheet|google/i.test(input)
      ? 'Google Sheets'
      : 'Webhook';

  return {
    status: 'completed',
    summary: `Workflow blueprint generated for "${dominantGoal}".`,
    confidence: 84,
    extractedEntities: {
      workflow_type: /support|ticket/i.test(input) ? 'support_intake' : 'lead_qualification',
      estimated_steps: 5,
      suggested_integration: integration,
      roi_window_days: 30,
    },
    recommendedAction: 'Sign in to save and deploy this blueprint.',
    lockedActions: LOCKED_ACTIONS,
  };
}

function buildVoiceResult(input: string): SandboxResult {
  const transcript = compactText(input);
  const companyMatch = transcript.match(/from\s+([A-Za-z0-9&.\-\s]{2,40})/i);
  const needMatch = transcript.match(/need\s+([^.,;]{4,70})/i);

  return {
    status: 'completed',
    summary: 'Voice lead capture complete with transcript and qualification.',
    confidence: 81,
    extractedEntities: {
      transcript_preview: transcript.slice(0, 110),
      company: companyMatch ? companyMatch[1].trim() : 'Unknown company',
      lead_priority: /urgent|asap|today|high/i.test(transcript) ? 'high' : 'medium',
      lead_score: /budget|buy|pricing|demo/i.test(transcript) ? 86 : 72,
      detected_need: needMatch ? needMatch[1].trim() : 'General AI workflow support',
    },
    recommendedAction: 'Sign in to sync this lead to CRM/Sheets.',
    lockedActions: LOCKED_ACTIONS,
  };
}

function buildFileResult(fileName: string, context: string): SandboxResult {
  const lowerName = fileName.toLowerCase();
  const type =
    lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')
      ? 'image_intake'
      : lowerName.endsWith('.pdf')
        ? 'pdf_intake'
        : 'file_intake';

  return {
    status: 'completed',
    summary: 'File/image intake completed with structured extraction and routing suggestion.',
    confidence: 79,
    extractedEntities: {
      asset_name: fileName,
      intake_type: type,
      context: compactText(context) || 'No extra context provided',
      recommended_route: /invoice|bill|receipt/i.test(fileName + context) ? 'finance_ops' : 'support_ops',
      extracted_fields: /invoice|bill|receipt/i.test(fileName + context) ? 6 : 4,
    },
    recommendedAction: 'Sign in to export extracted data and trigger external actions.',
    lockedActions: LOCKED_ACTIONS,
  };
}

export function TryGrindctrlSandbox() {
  const [mode, setMode] = useState<SandboxMode>('workflow');
  const [workflowInput, setWorkflowInput] = useState('');
  const [voiceInput, setVoiceInput] = useState('');
  const [voiceFileName, setVoiceFileName] = useState('');
  const [intakeContext, setIntakeContext] = useState('');
  const [intakeFileName, setIntakeFileName] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<SandboxResult | null>(null);
  const [runCount, setRunCount] = useState(() => readRunHistory().length);

  const remainingRuns = useMemo(() => Math.max(MAX_RUNS_PER_DAY - runCount, 0), [runCount]);

  function consumeRunSlot() {
    const history = readRunHistory();
    const next = [...history, nowMs()];
    writeRunHistory(next);
    setRunCount(next.length);
  }

  function runSandbox() {
    setError('');
    const history = readRunHistory();
    if (history.length >= MAX_RUNS_PER_DAY) {
      setRunCount(history.length);
      setError('Daily anonymous sandbox cap reached. Sign in to continue.');
      return;
    }

    if (mode === 'workflow') {
      const normalized = compactText(workflowInput);
      if (!normalized) {
        setError('Add a workflow prompt first.');
        return;
      }
      const next = buildWorkflowResult(normalized);
      consumeRunSlot();
      setResult(next);
      return;
    }

    if (mode === 'voice') {
      const normalized = compactText(voiceInput);
      if (!normalized) {
        setError('Add a voice transcript or summary first.');
        return;
      }
      if (normalized.length > VOICE_CHAR_LIMIT) {
        setError('Voice copy exceeds 30-second sandbox limit. Shorten transcript.');
        return;
      }
      const next = buildVoiceResult(normalized);
      consumeRunSlot();
      setResult(next);
      return;
    }

    if (!intakeFileName) {
      setError('Upload one file or image to run intake.');
      return;
    }

    const next = buildFileResult(intakeFileName, intakeContext);
    consumeRunSlot();
    setResult(next);
  }

  return (
    <section id="try-grindctrl" className="border-b bg-muted/10">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="mb-8 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs uppercase tracking-widest">
            Try GrindCTRL
          </Badge>
          <Badge variant="outline" className="text-xs">14-day trial after sign-in</Badge>
          <Badge variant="outline" className="text-xs">Anonymous runs are not persisted</Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card className="border bg-card/70">
            <CardHeader className="space-y-3">
              <CardTitle className="text-2xl">Run 1 of 3 sandbox tests</CardTitle>
              <CardDescription className="text-sm leading-6">
                Anonymous mode supports workflow planning, voice lead capture, and file/image intake.
                Save, deploy, sync, and export stay locked until sign-in.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Button type="button" variant={mode === 'workflow' ? 'default' : 'outline'} onClick={() => setMode('workflow')}>
                  <Network className="mr-1 size-4" />
                  Workflow planner
                </Button>
                <Button type="button" variant={mode === 'voice' ? 'default' : 'outline'} onClick={() => setMode('voice')}>
                  <Mic className="mr-1 size-4" />
                  Voice lead capture
                </Button>
                <Button type="button" variant={mode === 'file' ? 'default' : 'outline'} onClick={() => setMode('file')}>
                  <FileUp className="mr-1 size-4" />
                  File/image intake
                </Button>
              </div>

              {mode === 'workflow' ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="workflow-input">Business workflow prompt</label>
                  <textarea
                    id="workflow-input"
                    className="min-h-28 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                    placeholder="Example: Route support tickets, auto-answer simple cases, escalate billing, sync qualified leads to CRM."
                    value={workflowInput}
                    onChange={(event) => setWorkflowInput(event.target.value)}
                  />
                </div>
              ) : null}

              {mode === 'voice' ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="voice-input">Voice transcript (max ~30s)</label>
                    <textarea
                      id="voice-input"
                      className="min-h-28 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                      placeholder="Example: Hi, I am Sara from Bright Dental. We need AI support for missed calls and new lead capture."
                      value={voiceInput}
                      onChange={(event) => setVoiceInput(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">{voiceInput.trim().length}/{VOICE_CHAR_LIMIT} chars</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="voice-file">Optional voice file (preview only)</label>
                    <input
                      id="voice-file"
                      type="file"
                      accept="audio/*"
                      className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5 file:text-foreground"
                      onChange={(event) => setVoiceFileName(event.target.files?.[0]?.name ?? '')}
                    />
                    {voiceFileName ? <p className="text-xs text-muted-foreground">Loaded: {voiceFileName}</p> : null}
                  </div>
                </div>
              ) : null}

              {mode === 'file' ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="intake-file">Upload one file/image</label>
                    <input
                      id="intake-file"
                      type="file"
                      className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5 file:text-foreground"
                      onChange={(event) => setIntakeFileName(event.target.files?.[0]?.name ?? '')}
                    />
                    {intakeFileName ? <p className="text-xs text-muted-foreground">Loaded: {intakeFileName}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="intake-context">Intake context</label>
                    <textarea
                      id="intake-context"
                      className="min-h-24 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                      placeholder="Example: Classify this invoice and route to finance approvals."
                      value={intakeContext}
                      onChange={(event) => setIntakeContext(event.target.value)}
                    />
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">Anonymous runs left today: {remainingRuns}</p>
                <Button type="button" onClick={runSandbox}>Generate structured result</Button>
              </div>

              {error ? <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">{error}</p> : null}
            </CardContent>
          </Card>

          <Card className="border bg-card/70" data-testid="sandbox-result">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="size-5 text-primary" />
                Structured output
              </CardTitle>
              <CardDescription>
                No anonymous persistence. External actions require sign-in.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!result ? (
                <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Run a sandbox test to preview workflow-grade output.
                </p>
              ) : (
                <>
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="text-sm font-semibold capitalize">{result.status}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <p className="text-sm text-muted-foreground">Summary</p>
                    <p className="text-sm font-medium">{result.summary}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <p className="mb-2 text-sm text-muted-foreground">Extracted entities</p>
                    <dl className="space-y-2">
                      {Object.entries(result.extractedEntities).map(([key, value]) => (
                        <div key={key} className="flex items-start justify-between gap-3 text-sm">
                          <dt className="font-medium text-muted-foreground">{key}</dt>
                          <dd className="text-right">{String(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <p className="text-sm text-muted-foreground">Confidence</p>
                    <p className="text-sm font-semibold">{result.confidence}%</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <p className="text-sm text-muted-foreground">Recommended next action</p>
                    <p className="text-sm font-medium">{result.recommendedAction}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <p className="mb-2 text-sm text-muted-foreground">Locked actions</p>
                    <div className="flex flex-wrap gap-2">
                      {result.lockedActions.map((action) => (
                        <Badge key={action} variant="outline" className="text-xs">
                          {action}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button asChild size="sm">
                      <Link href="/sign-up">
                        Start 14-day trial
                        <ArrowRight className="ml-1 size-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/sign-in">Sign in to unlock actions</Link>
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
