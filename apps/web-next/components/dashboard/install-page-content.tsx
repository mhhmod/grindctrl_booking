import React from 'react';
import { CopyButton } from '@/components/dashboard/copy-button';
import { getDomainStatusTone } from '@/lib/domains';
import { getInstallDomainSafety, getInstallStatus, getInstallStatusLabel, getInstallStatusTone } from '@/lib/adapters/install';
import type { WidgetDomain, WidgetInstallVerification, WidgetSite } from '@/lib/types';

function formatTimestamp(value?: string | null) {
  if (!value) return 'Not seen yet';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

export function InstallPageContent({
  site,
  domains,
  allowLocalhost,
  verificationState,
  canonicalSnippet,
  cspSnippet,
}: {
  site: WidgetSite;
  domains: WidgetDomain[];
  allowLocalhost: boolean;
  verificationState: {
    status: 'success' | 'error';
    verification: WidgetInstallVerification | null;
    message: string | null;
  };
  canonicalSnippet: string;
  cspSnippet: string;
}) {
  const verifiedDomains = domains.filter((domain) => domain.verification_status === 'verified');
  const installStatus = getInstallStatus(verificationState.verification);
  const domainSafety = getInstallDomainSafety(domains, verificationState.verification, allowLocalhost);

  return (
    <div className="grid gap-6">
      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white">Public embed key</p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">Use the current site embed key with the canonical loader snippet. This is safe for client-side installation.</p>
            </div>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              {site.status}
            </span>
          </div>

          <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <code className="break-all text-sm text-zinc-100">{site.embed_key}</code>
              <CopyButton value={site.embed_key} label="Copy key" />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm font-medium text-white">Canonical install contract</p>
          <p className="mt-2 text-sm leading-6 text-zinc-400">This preserves the existing queue-first `GrindctrlSupport` loader contract and does not invent a new embed format.</p>
          <ul className="mt-4 grid gap-2 text-sm text-zinc-300">
            <li>Uses the public embed key from the selected widget site</li>
            <li>Loads the existing versioned loader from `cdn.grindctrl.com`</li>
            <li>Keeps the public widget runtime separate from the React app</li>
          </ul>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Install verification</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">Uses the latest backend-recorded `widget_heartbeat` event so operators can confirm the selected install is alive without changing the snippet contract.</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${getInstallStatusTone(installStatus)}`}>{getInstallStatusLabel(installStatus)}</span>
          </div>

          {verificationState.status === 'error' ? (
            <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-200">
              <p className="font-medium">Unable to load install verification.</p>
              <p className="mt-2 leading-6 text-rose-100/80">{verificationState.message ?? 'The heartbeat read contract returned an error.'}</p>
            </div>
          ) : null}

          {verificationState.status === 'success' && !verificationState.verification?.last_heartbeat_at ? (
            <div className="mt-5 rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-4 text-sm text-zinc-400">
              <p className="font-medium text-zinc-200">This widget has not been seen yet.</p>
              <p className="mt-2 leading-6">Once the canonical snippet boots on an allowed origin, the runtime will emit a heartbeat and the latest activity will appear here.</p>
            </div>
          ) : null}

          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <dt className="text-sm text-zinc-500">Last heartbeat</dt>
              <dd className="mt-2 text-sm text-zinc-100">{formatTimestamp(verificationState.verification?.last_heartbeat_at)}</dd>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <dt className="text-sm text-zinc-500">Last seen origin</dt>
              <dd className="mt-2 break-all text-sm text-zinc-100">{verificationState.verification?.last_seen_origin ?? 'Not seen yet'}</dd>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:col-span-2">
              <dt className="text-sm text-zinc-500">Last seen domain</dt>
              <dd className="mt-2 text-sm text-zinc-100">{verificationState.verification?.last_seen_domain ?? 'Not seen yet'}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Domain safety</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">Install snippets stay unchanged, but production rollout should be tied to the real allowed-domain state for this site.</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${domainSafety.tone}`}>
              {domainSafety.label}
            </span>
          </div>

          <div className={`mt-5 rounded-2xl border p-4 text-sm ${domainSafety.tone}`}>
            {domainSafety.summary}
          </div>

          {domains.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              No allowed domains are configured yet. Add at least one production hostname in Domains before sending this snippet to live customer sites.
            </div>
          ) : (
            <ul className="mt-5 grid gap-3">
              {domains.map((domain) => (
                <li key={domain.id} className="flex flex-col gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-zinc-100">{domain.domain}</span>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium capitalize ${getDomainStatusTone(domain.verification_status)}`}>
                    {domain.verification_status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold text-white">Development behavior</h2>
          <ul className="mt-4 grid gap-3 text-sm text-zinc-300">
            <li className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">Verified production domains: {verifiedDomains.length}</li>
            <li className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">Configured hostnames: {domains.length}</li>
            <li className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">Localhost/dev access: {allowLocalhost ? 'Enabled through settings_json security defaults.' : 'Disabled in settings_json.'}</li>
            <li className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">Heartbeat read path: `dashboard_get_install_verification`</li>
          </ul>
          <p className="mt-4 text-sm leading-6 text-zinc-400">`localhost` can stay available for development while production installs should use verified hostnames from the current site domain list.</p>
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Standard snippet</h2>
            <p className="mt-1 text-sm text-zinc-400">Recommended for the primary install path.</p>
          </div>
          <CopyButton value={canonicalSnippet} label="Copy snippet" />
        </div>
        <pre className="mt-5 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-6 text-zinc-200">
          <code>{canonicalSnippet}</code>
        </pre>
      </section>

      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">CSP-friendly snippet</h2>
            <p className="mt-1 text-sm text-zinc-400">Use this variant when you need a no-inline-script install path.</p>
          </div>
          <CopyButton value={cspSnippet} label="Copy CSP snippet" />
        </div>
        <pre className="mt-5 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-6 text-zinc-200">
          <code>{cspSnippet}</code>
        </pre>
      </section>
    </div>
  );
}
