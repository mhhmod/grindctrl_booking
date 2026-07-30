/* Picks the merchant's own strings for the shopper's language.

   The widget's built-in UI has always been bilingual, but the three strings
   the merchant writes themselves (the button label, the catalog pill label,
   and a custom disclaimer) were single values sent to every shopper. An
   Arabic customer got an Arabic widget wrapped around an English button.

   Kept free of server-only imports so the storefront route, the embed page,
   and the dashboard preview can all share it. */

import type { TryOnLocale } from './i18n';

export type MerchantCopyInput = {
  buttonLabel: string;
  buttonLabelAr: string | null;
  catalogLabel: string;
  catalogLabelAr: string | null;
  disclaimerText: string | null;
  disclaimerTextAr: string | null;
};

export type MerchantCopy = {
  buttonLabel: string;
  catalogLabel: string;
  disclaimerText: string | null;
};

/* Blank means "not translated", not "show nothing". Merchants routinely fill
   one language and leave the other empty, and an empty button is far worse
   than a button in the wrong language. */
function filled(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function pickMerchantCopy(
  input: MerchantCopyInput,
  locale: TryOnLocale,
): MerchantCopy {
  const preferArabic = locale === 'ar';

  const pick = (base: string | null, arabic: string | null): string | null =>
    preferArabic ? (filled(arabic) ?? filled(base)) : (filled(base) ?? filled(arabic));

  return {
    // These two always render, so fall back to the input rather than empty.
    buttonLabel: pick(input.buttonLabel, input.buttonLabelAr) ?? input.buttonLabel,
    catalogLabel: pick(input.catalogLabel, input.catalogLabelAr) ?? input.catalogLabel,
    /* null is meaningful here: it tells the widget to use its own translated
       disclaimer. Preserve it instead of coercing to a string. */
    disclaimerText: pick(input.disclaimerText, input.disclaimerTextAr),
  };
}
