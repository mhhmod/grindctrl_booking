import type { WidgetDomain, WidgetInstallVerification } from '@/lib/types';

const LOADER_URL = 'https://cdn.grindctrl.com/widget/v1/loader.js';
export const ACTIVE_INSTALL_WINDOW_MS = 30 * 60 * 1000;

export type InstallStatus = 'never_seen' | 'active' | 'stale';

export interface InstallDomainSafety {
  label: string;
  tone: string;
  summary: string;
}

export function buildCanonicalInstallSnippet(embedKey: string) {
  const key = String(embedKey || 'gc_live_xxxxx');

  return [
    '<script>',
    '  window.GrindctrlSupport = window.GrindctrlSupport || [];',
    '  window.GrindctrlSupport.push({',
    `    embedKey: '${key}',`,
    '    user: {',
    '      id: null,',
    '      email: null,',
    '      name: null',
    '    },',
    '    context: {',
    '      custom: {}',
    '    }',
    '  });',
    '</script>',
    `<script async src="${LOADER_URL}"></script>`,
  ].join('\n');
}

export function buildCspInstallSnippet(embedKey: string) {
  const key = String(embedKey || 'gc_live_xxxxx');

  return [
    '<script',
    '  async',
    `  src="${LOADER_URL}"`,
    `  data-gc-embed-key="${key}">`,
    '</script>',
  ].join('\n');
}

export function getInstallStatus(verification: WidgetInstallVerification | null, now = new Date()): InstallStatus {
  const lastHeartbeat = verification?.last_heartbeat_at;
  if (!lastHeartbeat) return 'never_seen';

  const heartbeatTime = new Date(lastHeartbeat).getTime();
  if (Number.isNaN(heartbeatTime)) return 'stale';

  return now.getTime() - heartbeatTime <= ACTIVE_INSTALL_WINDOW_MS ? 'active' : 'stale';
}

export function getInstallStatusTone(status: InstallStatus) {
  if (status === 'active') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  if (status === 'stale') return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
  return 'border-zinc-700 bg-zinc-800 text-zinc-300';
}

export function getInstallStatusLabel(status: InstallStatus) {
  if (status === 'active') return 'Active';
  if (status === 'stale') return 'Stale';
  return 'Never seen';
}

export function getInstallDomainSafety(domains: WidgetDomain[], verification: WidgetInstallVerification | null, allowLocalhost: boolean): InstallDomainSafety {
  const verifiedDomains = domains.filter((domain) => domain.verification_status === 'verified').map((domain) => domain.domain.toLowerCase());
  const configuredDomains = domains.map((domain) => domain.domain.toLowerCase());
  const lastSeenDomain = verification?.last_seen_domain?.toLowerCase() ?? null;

  if (domains.length === 0) {
    return {
      label: 'Action needed',
      tone: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
      summary: 'No allowed domains are configured yet. Add at least one production hostname before rollout.',
    };
  }

  if (!lastSeenDomain) {
    return {
      label: 'Waiting for heartbeat',
      tone: 'border-zinc-700 bg-zinc-800 text-zinc-300',
      summary: 'Domains are configured, but this site has not emitted a heartbeat yet.',
    };
  }

  if (verifiedDomains.includes(lastSeenDomain)) {
    return {
      label: 'Verified origin',
      tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
      summary: `Last seen on ${lastSeenDomain}, which is already verified for this site.`,
    };
  }

  if (allowLocalhost && (lastSeenDomain === 'localhost' || lastSeenDomain === '127.0.0.1')) {
    return {
      label: 'Local development',
      tone: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
      summary: `Last seen on ${lastSeenDomain}. Development access is currently allowed through settings_json.`,
    };
  }

  if (configuredDomains.includes(lastSeenDomain)) {
    return {
      label: 'Verification warning',
      tone: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
      summary: `Last seen on ${lastSeenDomain}, but that hostname is not currently verified.`,
    };
  }

  return {
    label: 'Domain warning',
    tone: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    summary: `Last seen on ${lastSeenDomain}, which is not in the current allowed domain list.`,
  };
}

export function containsLegacyInstallPattern(snippet: string) {
  return [
    'window.GRINDCTRL_ID',
    'cdn.example.com/widget.js',
    'GrindctrlSupport.init',
    'https://cdn.grindctrl.com/grindctrl-support.js',
  ].some((value) => snippet.includes(value));
}

export const installContract = {
  loaderUrl: LOADER_URL,
};
