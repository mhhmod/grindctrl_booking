import { SITE_LOCALES, type SiteLocale } from '@/lib/landing/landing-i18n';

type RankedTag = { tag: string; primary: string; q: number };

/* Parses Accept-Language into tags ordered by preference.

   A tag with no q means q=1, and an unparseable q is treated as 1 rather than
   0, so a malformed header still expresses a preference instead of being
   silently discarded. The empty case is checked separately because Number('')
   is 0, not NaN — so "ar;q=" would otherwise score zero and drop the language
   entirely. */
function rankTags(header: string | null): RankedTag[] {
  if (!header?.trim()) return [];

  return header
    .split(',')
    .map((part) => {
      const [rawTag, ...params] = part.trim().split(';');
      const qParam = params.find((p) => p.trim().startsWith('q='));
      const rawQ = qParam ? qParam.trim().slice(2).trim() : '';
      const parsed = rawQ === '' ? 1 : Number(rawQ);
      const q = Number.isFinite(parsed) ? parsed : 1;
      const tag = rawTag.trim();
      return { tag, primary: tag.toLowerCase().split('-')[0], q };
    })
    .filter((entry) => entry.primary && entry.primary !== '*' && entry.q > 0)
    /* Sort is stable, so document order decides ties — which is what browsers
       intend when they omit q. */
    .sort((a, b) => b.q - a.q);
}

/* The visitor's language, from what their browser says they read.

   Unlike currency this needs no external data: every browser sends it on every
   request. Using it means an Arabic speaker lands on Arabic without hunting for
   a toggle.

   Returns null rather than guessing when nothing matches, so the caller keeps
   ownership of the default. A French speaker should get the site default, not
   whichever of our two languages happens to sort first. */
export function localeFromAcceptLanguage(header: string | null): SiteLocale | null {
  for (const { primary } of rankTags(header)) {
    if ((SITE_LOCALES as readonly string[]).includes(primary)) {
      return primary as SiteLocale;
    }
  }

  return null;
}

/* The visitor's country, from the region subtag — "ar-EG" says Egypt.

   A weaker signal than a GeoIP lookup: it reflects how the device is
   configured rather than where it is, so a traveller or an expat reports their
   home locale. But it needs no database, no account and no network call, and
   it is the only country signal available until the GeoLite2 file is on the
   server. Used as a fallback beneath IP lookup, never above it. */
export function regionFromAcceptLanguage(header: string | null): string | null {
  for (const { tag } of rankTags(header)) {
    const subtags = tag.split('-').slice(1);
    /* A two-letter subtag is a region; four letters is a script (zh-Hans), and
       scripts are not countries. */
    const region = subtags.find((s) => /^[A-Za-z]{2}$/.test(s));
    if (region) return region.toUpperCase();
  }

  return null;
}
