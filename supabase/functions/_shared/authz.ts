import { anyAllowedDomainMatch, isLocalhostHost } from './domains.ts';
import { parseUrlOrigin } from './http.ts';
import { serviceClient } from './supabase.ts';

export async function isOriginAllowedForSite(widgetSiteId: string, origin: string): Promise<boolean> {
  const originParsed = parseUrlOrigin(origin);
  if (!originParsed) return false;

  const supabase = serviceClient();

  const { data: site } = await supabase
    .from('widget_sites')
    .select('id, settings_json')
    .eq('id', widgetSiteId)
    .limit(1)
    .maybeSingle();

  if (!site) return false;
  const allowLocalhost = Boolean((site as any).settings_json?.security?.allow_localhost ?? true);

  const { data: domains } = await supabase
    .from('widget_domains')
    .select('pattern, domain, verification_status, disabled_at')
    .eq('widget_site_id', widgetSiteId);

  const verifiedPatterns = (domains || [])
    .filter((d: any) => d && d.verification_status === 'verified' && !d.disabled_at)
    .map((d: any) => String(d.pattern || d.domain || ''))
    .filter((p: string) => p);

  const host = originParsed.host;
  const isLocal = isLocalhostHost(host);
  return (isLocal && allowLocalhost) || anyAllowedDomainMatch(host, verifiedPatterns);
}
