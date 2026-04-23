import Link from 'next/link';
import type { WidgetDomain, WidgetIntent, WidgetLead, WidgetSite, Workspace } from '@/lib/types';

function metricLabel(value: number | null, emptyLabel = 'No data yet') {
  if (value === null) return emptyLabel;
  return value.toLocaleString();
}

export function OverviewPageContent({
  workspace,
  site,
  role,
  domains,
  intents,
  leads,
}: {
  workspace: Workspace;
  site: WidgetSite | null;
  role: string | null;
  domains: WidgetDomain[];
  intents: WidgetIntent[];
  leads: WidgetLead[];
}) {
  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="text-sm text-zinc-500">Workspace</div>
          <div className="mt-3 text-xl font-semibold text-white">{workspace.name}</div>
          <div className="mt-2 text-sm text-zinc-400">Role: {role ?? 'Unavailable'}</div>
        </div>
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="text-sm text-zinc-500">Selected site</div>
          <div className="mt-3 text-xl font-semibold text-white">{site?.name ?? 'No widget sites yet'}</div>
          <div className="mt-2 text-sm text-zinc-400">Status: {site?.status ?? 'draft'}</div>
        </div>
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="text-sm text-zinc-500">Allowed domains</div>
          <div className="mt-3 text-xl font-semibold text-white">{metricLabel(domains.length)}</div>
          <div className="mt-2 text-sm text-zinc-400">Real domain count from `dashboard_list_domains`.</div>
        </div>
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="text-sm text-zinc-500">Captured leads</div>
          <div className="mt-3 text-xl font-semibold text-white">{metricLabel(leads.length)}</div>
          <div className="mt-2 text-sm text-zinc-400">Real lead count from `dashboard_list_leads`.</div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Install readiness</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">The install surface is production-real and uses the current widget site embed key plus the canonical loader contract.</p>
            </div>
            <Link href="/dashboard/install" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-800">
              Open install
            </Link>
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <dt className="text-sm text-zinc-500">Embed key</dt>
              <dd className="mt-2 break-all text-sm text-zinc-100">{site?.embed_key ?? 'No site available'}</dd>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <dt className="text-sm text-zinc-500">Intent count</dt>
              <dd className="mt-2 text-sm text-zinc-100">{metricLabel(intents.length)}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold text-white">Analytics availability</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">Conversation analytics are not fabricated here. Until those backend metrics are exposed through a real contract, the dashboard shows safe placeholders instead of fake charts.</p>
          <div className="mt-5 rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-4 text-sm text-zinc-400">
            Conversation volume, active visitors, and escalation trends are still deferred pending a production data surface.
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold text-white">Recent leads</h2>
          {leads.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-4 text-sm text-zinc-400">
              No leads have been captured for this scope yet.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {leads.slice(0, 5).map((lead) => (
                <li key={lead.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="text-sm font-medium text-zinc-100">{lead.email ?? lead.name ?? 'Unnamed lead'}</div>
                  <div className="mt-1 text-sm text-zinc-500">{lead.source_domain ?? 'Unknown source'}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold text-white">Current scope</h2>
          <ul className="mt-4 grid gap-3 text-sm text-zinc-300">
            <li className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">Domains loaded from `dashboard_list_domains`</li>
            <li className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">Intents loaded from `dashboard_list_intents`</li>
            <li className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">Leads loaded from `dashboard_list_leads`</li>
            <li className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">Editable widget config stays consolidated in `settings_json`</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
