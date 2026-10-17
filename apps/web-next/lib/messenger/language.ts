/* Which language a shopper writes in, and text normalised for matching.
   No server-only import: the panel tests and the pre-check table read it
   too. ai.ts re-exports isFrancoArabic and detectLocale from here. */

import type { MessengerLocale } from './types';

/* Franco-Arabic (Arabic written in Latin letters, common in Egypt): digits
   standing for Arabic sounds inside words (3ayez, a2dar, 7aga), or everyday
   words that are not English. Two hits, so one stray word never flips an
   English message. */
const FRANCO_DIGIT_WORD = /\b[a-z]*[a-z][2375][a-z]+[a-z0-9]*\b|\b[2375][a-z]{2,}\b/gi;
const FRANCO_WORDS = /\b(ana|enta|enty|ezay|ezayak|3ayez|3ayza|3awez|3ayz|fen|feen|leh|keda|kda|mesh|msh|momken|mumkin|law|lw|b kam|bkam|shokran|el|elly|alli|wana|ya3ni|7aga|3ashan|3shan|ba2a|delwa2ty|dlw2ty)\b/gi;

export function isFrancoArabic(text: string): boolean {
  const hits = (text.match(FRANCO_DIGIT_WORD) ?? []).length + (text.match(FRANCO_WORDS) ?? []).length;
  return hits >= 2;
}

export function detectLocale(text: string): MessengerLocale {
  const arabic = (text.match(/[؀-ۿ]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  if (arabic > latin) return 'ar';
  return isFrancoArabic(text) ? 'ar' : 'en';
}

export type ShopperLanguage = 'en' | 'ar' | 'franco';

/** The script the shopper wrote in, with Franco told apart from Arabic. */
export function shopperLanguage(text: string): ShopperLanguage {
  const arabic = (text.match(/[؀-ۿ]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  if (arabic > latin) return 'ar';
  return isFrancoArabic(text) ? 'franco' : 'en';
}

/** Lower case, Arabic letter forms and digits folded, punctuation turned
 *  into spaces, padded with one space each side so every word sits between
 *  two spaces. Apostrophes are dropped, so "I'd" reads "id" and Franco
 *  "3'ayar" reads "3ayar". */
export function normalizeForMatch(text: string): string {
  const folded = text
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/['’‘`]/g, '')
    .replace(/[^\p{L}\p{N}#]+/gu, ' ')
    .trim();
  return ` ${folded} `;
}
