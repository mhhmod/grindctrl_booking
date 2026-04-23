import type { WidgetDomain } from '@/lib/types';

export interface DomainsState {
  domains: WidgetDomain[];
  message: string | null;
  messageType: 'success' | 'error' | null;
  fieldError: string | null;
}

export function getInitialDomainsState(domains: WidgetDomain[]): DomainsState {
  return {
    domains,
    message: null,
    messageType: null,
    fieldError: null,
  };
}
