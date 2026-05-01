import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarClock,
  FileText,
  FormInput,
  ImageIcon,
  Inbox,
  Mail,
  MessageSquare,
  Mic,
  PlaySquare,
  Route,
  Sparkles,
  Table2,
  TicketCheck,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TrialPathCard } from '@/components/landing/trial-path-card';

const inputNodes = [
  { label: 'Text', icon: MessageSquare },
  { label: 'Voice', icon: Mic },
  { label: 'Image', icon: ImageIcon },
  { label: 'Video', icon: PlaySquare },
  { label: 'File', icon: FileText },
  { label: 'Form', icon: FormInput },
  { label: 'Event/API', icon: Zap },
];

const outputNodes = [
  { label: 'Support answer', icon: Bot },
  { label: 'Lead score', icon: UserCheck },
  { label: 'CRM update', icon: Route },
  { label: 'Google Sheet row', icon: Table2 },
  { label: 'Ticket', icon: TicketCheck },
  { label: 'Email reply', icon: Mail },
  { label: 'Booking suggestion', icon: CalendarClock },
  { label: 'Dashboard insight', icon: BarChart3 },
  { label: 'Human handoff', icon: Users },
];

const templates = [
  {
    name: 'Voice Lead Capture',
    trigger: 'Missed call or voice note',
    processing: 'Transcribe, qualify, route',
    action: 'Create lead + owner task',
    bestFor: 'Sales and service teams',
    status: 'Ready for preview',
  },
  {
    name: 'AI Customer Support',
    trigger: 'Website or inbox request',
    processing: 'Classify intent + urgency',
    action: 'Answer, ticket, or handoff',
    bestFor: 'Support desks',
    status: 'Ready for preview',
  },
  {
    name: 'File Intake Automation',
    trigger: 'Invoice, contract, screenshot',
    processing: 'Extract fields + route',
    action: 'CRM/Sheet-ready record',
    bestFor: 'Ops and admin teams',
    status: 'Ready for preview',
  },
  {
    name: 'CRM Lead Qualification',
    trigger: 'Form or chat lead',
    processing: 'Score + segment',
    action: 'Update CRM + next step',
    bestFor: 'Pipeline teams',
    status: 'Coming soon',
  },
  {
    name: 'Video/Meeting Intelligence',
    trigger: 'Recording or clip',
    processing: 'Summarize decisions',
    action: 'Tasks + digest',
    bestFor: 'Client operations',
    status: 'Coming soon',
  },
  {
    name: 'Daily Operations Digest',
    trigger: 'Scheduled workflow',
    processing: 'Collect signals',
    action: 'Send daily summary',
    bestFor: 'Founders and managers',
    status: 'Coming soon',
  },
];

const integrationGroups: Array<{ group: string; items: string[] }> = [
  { group: 'AI Models', items: ['OpenAI', 'Gemini', 'Groq', 'OpenRouter'] },
  { group: 'CRM', items: ['HubSpot', 'Salesforce', 'Pipedrive', 'Google Sheets'] },
  { group: 'Communication', items: ['WhatsApp', 'Telegram', 'Email'] },
  { group: 'Operations', items: ['Google Calendar', 'Notion', 'Slack', 'APIs'] },
  { group: 'Infrastructure', items: ['Supabase', 'n8n', 'Cloudflare', 'Hostinger'] },
];

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="mb-10 max-w-3xl space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {eyebrow}
      </p>
      <h2 className="text-[30px] font-bold leading-[1.1] tracking-normal sm:text-4xl lg:text-[44px] lg:leading-[1.05]">
        {title}
      </h2>
      <p className="text-base leading-[1.65] text-muted-foreground sm:text-lg">{body}</p>
    </div>
  );
}

function NodeCard({
  label,
  icon: Icon,
  index,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  index: number;
}) {
  return (
    <div
      className="gc-card-hover gc-node-pulse min-h-[132px] rounded-2xl border border-white/10 bg-card/60 p-[18px]"
      style={{ animationDelay: `${index * 0.22}s` }}
    >
      <div className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04]">
        <Icon className="size-5 text-primary" />
      </div>
      <p className="mt-4 text-sm font-semibold">{label}</p>
      <p className="mt-2 text-[13px] leading-[1.55] text-muted-foreground">
        {index < inputNodes.length ? 'Captured as workflow context.' : 'Prepared as a business action.'}
      </p>
    </div>
  );
}

function OperationsPreview() {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="gc-card-hover min-h-[360px] rounded-3xl border-white/10 bg-card/60">
        <CardContent className="p-5">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Inbox className="size-5 text-primary" />
              <h3 className="font-semibold">Support Inbox</h3>
            </div>
            <Badge variant="outline" className="rounded-full border-white/10">Static preview</Badge>
          </div>
          {['Billing question routed to support', 'Product issue ready for handoff', 'Setup request matched to onboarding'].map((item) => (
            <div key={item} className="mb-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-sm font-medium">{item}</p>
              <p className="mt-1 text-xs text-muted-foreground">Intent, priority, owner, next step</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="gc-card-hover min-h-[360px] rounded-3xl border-white/10 bg-card/60">
        <CardContent className="p-5">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="size-5 text-primary" />
              <h3 className="font-semibold">Lead Pipeline</h3>
            </div>
            <Badge variant="outline" className="rounded-full border-white/10">Static preview</Badge>
          </div>
          {['New inquiry', 'Qualified', 'Human follow-up'].map((column) => (
            <div key={column} className="mb-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-sm font-semibold">{column}</p>
              <div className="mt-3 h-2 rounded-full bg-white/10">
                <div className="h-2 w-2/3 rounded-full bg-primary/70" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="gc-card-hover min-h-[360px] rounded-3xl border-white/10 bg-card/60">
        <CardContent className="p-5">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="size-5 text-primary" />
              <h3 className="font-semibold">Operations Digest</h3>
            </div>
            <Badge variant="outline" className="rounded-full border-white/10">Static preview</Badge>
          </div>
          {['Customer signals grouped by route', 'Prepared actions waiting for approval', 'Open handoffs ready for review'].map((item) => (
            <div key={item} className="mb-3 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              <p className="text-sm leading-6">{item}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function LandingAfterPlaygroundSections() {
  return (
    <>
      <section id="capabilities" className="border-b border-white/10">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <SectionHeading
            eyebrow="Multimodal action map"
            title="Every signal can become a routed business action."
            body="GrindCTRL shows text, voice, images, video, files, forms, and events as structured workflow inputs, then prepares the next action for your team."
          />
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
            {[...inputNodes, ...outputNodes].map((node, index) => (
              <NodeCard key={`${node.label}-${index}`} {...node} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section id="templates" className="border-b border-white/10 bg-muted/10">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <SectionHeading
            eyebrow="Workflow templates"
            title="Start from patterns your operations team already understands."
            body="Templates use a compact pipeline shape: trigger, AI processing, prepared action, best-fit team, and preview status."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.name} className="gc-card-hover gc-template-progress rounded-2xl border-white/10 bg-card/60">
                <CardContent className="p-[18px]">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold">{template.name}</h3>
                      <p className="mt-1 text-[13px] text-muted-foreground">{template.bestFor}</p>
                    </div>
                    <Badge variant={template.status === 'Ready for preview' ? 'secondary' : 'outline'} className="shrink-0 rounded-full text-[11px]">
                      {template.status}
                    </Badge>
                  </div>
                  <div className="grid gap-2 text-[13px]">
                    {[
                      ['Trigger', template.trigger],
                      ['AI processing', template.processing],
                      ['Prepared action', template.action],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <p className="text-muted-foreground">{label}</p>
                        <p className="mt-1 font-medium">{value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="operations-preview" className="border-b border-white/10">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <SectionHeading
            eyebrow="Business operations preview"
            title="Static app previews show where workflow output lands."
            body="The landing page stays honest: these are visual previews of support, lead, and operations surfaces, not live dashboards or connected accounts."
          />
          <OperationsPreview />
        </div>
      </section>

      <section id="integrations" className="border-b border-white/10 bg-muted/10">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <SectionHeading
            eyebrow="Connectable systems"
            title="Designed around the tools teams already use."
            body="Use GrindCTRL to plan how AI models, CRMs, communication channels, operations tools, and infrastructure fit together."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {integrationGroups.map(({ group, items }) => (
              <Card key={group} className="gc-card-hover rounded-2xl border-white/10 bg-card/60">
                <CardContent className="p-[18px]">
                  <h3 className="text-sm font-semibold">{group}</h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {items.map((item) => (
                      <Badge key={item} variant="outline" className="rounded-full border-white/10 bg-white/[0.03] text-[11px]">
                        {item} connectable
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="trial-path" className="border-b border-white/10">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <SectionHeading
            eyebrow="Trial path"
            title="Free guided preview, then a workspace, then custom implementation."
            body="Start with the playground, continue in a 14-day trial, and turn the winning workflow into a production implementation."
          />
          <TrialPathCard />
        </div>
      </section>

      <section className="border-b border-white/10 bg-muted/10">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <Card className="rounded-3xl border-white/10 bg-card/80">
            <CardContent className="flex flex-col items-center gap-6 p-8 text-center sm:p-12">
              <div className="max-w-2xl space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Start here
                </p>
                <h2 className="text-[30px] font-bold leading-[1.1] sm:text-4xl lg:text-[44px] lg:leading-[1.05]">
                  Preview your first AI workflow today.
                </h2>
                <p className="text-base leading-[1.65] text-muted-foreground">
                  Use the playground to see what GrindCTRL prepares before connecting tools or deploying actions.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 rounded-xl px-5 text-sm font-semibold">
                  <a href="#try-grindctrl">
                    Try the playground
                    <ArrowRight className="ms-2 size-4" />
                  </a>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-12 rounded-xl border-white/10 bg-white/[0.03] px-5 text-sm font-semibold">
                  <Link href="/sign-up">Start 14-day trial</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
