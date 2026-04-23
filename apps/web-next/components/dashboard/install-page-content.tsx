import React from 'react';
import { CopyButton } from '@/components/dashboard/copy-button';
import { getDomainStatusTone } from '@/lib/domains';
import type { WidgetDomain, WidgetSite } from '@/lib/types';

export function InstallPageContent({
  site,
  domains,
  allowLocalhost,
  canonicalSnippet,
  cspSnippet,
}: {
  site: WidgetSite;
  domains: WidgetDomain[];
  allowLocalhost: boolean;
  canonicalSnippet: string;
  cspSnippet: string;
}) {
  const verifiedDomains = domains.filter((domain) => domain.verification_status === 'verified');

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
              <h2 className="text-lg font-semibold text-white">Domain safety</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">Install snippets stay unchanged, but production rollout should be tied to the real allowed-domain state for this site.</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${domains.length === 0 ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>
              {domains.length === 0 ? 'Action needed' : 'Configured'}
            </span>
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
