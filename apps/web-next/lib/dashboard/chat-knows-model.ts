/* What the v16 Store Chat page's head and its What it knows tab show
   (04-dashboard.md, the Knowledge board), from what the app has. Left out
   until their back ends exist, rather than guessed: Questions it couldn't
   answer and Answers you approved (N8's grouping and approving), Try it
   (N49), and Products, Policies and Size charts (N9's catalogue sync),
   with the line saying the assistant stays in sync with the store. */

import type { KnowledgeEntry } from '@/lib/messenger/knowledge';
import type { FrameBadge } from '@/components/dashboard/v16/page-frame';
import type { ChatKnowsCopy } from './chat-knows-copy';

const DAY = 86_400_000;
/** Titles named in the Pages and notes line before "and 3 more". */
const NAMED_TITLES = 2;

export type ChatHeadFacts = {
  active: boolean;
  domain: string | null;
  /** The last 7 days' finished chats: the assistant's, and those it handed on. */
  solved7: number | null;
  handedOff7: number | null;
};

export type ChatHead = { badge: FrameBadge; subtitle: string | null; storeUrl: string | null };

export type KnowledgeRow = {
  id: string;
  title: string;
  kind: 'note' | 'page';
  host: string | null;
  active: boolean;
  freshness: string;
  canResync: boolean;
};

export type PagesAndNotes = { summary: string; rows: KnowledgeRow[] };

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** The domain shoppers visit, as typed on the site, without a scheme. */
function cleanDomain(domain: string | null): string | null {
  const host = domain?.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '') ?? '';
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ? host : null;
}

export function buildChatHead(facts: ChatHeadFacts, copy: ChatKnowsCopy): ChatHead {
  const domain = cleanDomain(facts.domain);
  const finished = (facts.solved7 ?? 0) + (facts.handedOff7 ?? 0);
  let subtitle: string | null = null;
  if (facts.solved7 !== null && facts.handedOff7 !== null) {
    subtitle = finished > 0 ? copy.answeredShare(Math.round(((facts.solved7 ?? 0) / finished) * 100), finished) : copy.noChatsYet;
  }
  return {
    badge: facts.active ? { live: true, label: domain ? copy.liveOn(domain) : copy.live } : { live: false, label: copy.hidden },
    subtitle,
    storeUrl: domain ? `https://${domain}` : null,
  };
}

function wholeDaysSince(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  return Number.isFinite(at) ? Math.max(0, Math.floor((now - at) / DAY)) : null;
}

/** Pages and notes is today's knowledge: the notes and the pages added by
 *  link. Other sources get their own cards when their back ends land. */
export function buildPagesAndNotes(entries: KnowledgeEntry[], copy: ChatKnowsCopy, now: number = Date.now()): PagesAndNotes {
  const own = entries.filter((entry) => entry.source === 'manual' || entry.source === 'url');
  const rows = own.map((entry): KnowledgeRow => {
    const page = entry.source === 'url';
    const days = wholeDaysSince(page ? entry.last_synced_at : entry.updated_at, now);
    const freshness = page
      ? days === null
        ? copy.neverSynced
        : days === 0
          ? copy.syncedToday
          : copy.syncedDaysAgo(days)
      : days === null || days === 0
        ? copy.updatedToday
        : copy.updatedDaysAgo(days);
    return {
      id: entry.id,
      title: entry.title,
      kind: page ? 'page' : 'note',
      host: page ? hostOf(entry.source_url) : null,
      active: entry.status === 'active',
      freshness,
      canResync: page && Boolean(entry.source_url),
    };
  });
  const titles = own.map((entry) => entry.title.trim()).filter(Boolean);
  const named = titles.slice(0, NAMED_TITLES);
  return {
    summary: titles.length ? copy.titlesList(named, titles.length - named.length) : copy.pagesAndNotesNone,
    rows,
  };
}
