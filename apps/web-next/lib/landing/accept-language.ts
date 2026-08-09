import { SITE_LOCALES, type SiteLocale } from '@/lib/landing/landing-i18n';

/* Reads the visitor's language preference from the Accept-Language header.

   Unlike currency, this needs no external data: every browser sends this on
   every request, stating what the person actually reads. Using it means an
   Arabic speaker lands on Arabic without touching a toggle.

   Returns null rather than guessing when nothing matches, so the caller keeps
   ownership of the default. A French speaker should get the site default, not
   whichever of our two languages happens to sort first. */
export function localeFromAcceptLanguage(header: string | null): SiteLocale | null {
  if (!header?.trim()) return null;

  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const qParam = params.find((p) => p.trim().startsWith('q='));
      const rawQ = qParam ? qParam.trim().slice(2).trim() : '';
      /* A tag with no q means q=1, and an unparseable q is treated as 1 rather
         than 0, so a malformed header still expresses a preference instead of
         being silently discarded.

         The empty case is checked separately because Number('') is 0, not NaN —
         so "ar;q=" would otherwise score zero and drop the language entirely. */
      const parsed = rawQ === '' ? 1 : Number(rawQ);
      const q = Number.isFinite(parsed) ? parsed : 1;
      return { primary: tag.trim().toLowerCase().split('-')[0], q };
    })
    .filter((entry) => entry.primary && entry.primary !== '*' && entry.q > 0)
    /* Stable sort by descending q: document order decides ties, which is what
       browsers intend when they omit q. */
    .sort((a, b) => b.q - a.q);

  for (const { primary } of ranked) {
    if ((SITE_LOCALES as readonly string[]).includes(primary)) {
      return primary as SiteLocale;
    }
  }

  return null;
}
