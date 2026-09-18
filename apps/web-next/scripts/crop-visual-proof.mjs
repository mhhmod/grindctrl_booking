/* Cuts the homepage hero crops out of the full product captures made by
   scripts/capture-visual-proof.mjs, so the hero shows real interface text at a
   readable size instead of a whole screen shrunk to a thumbnail.

   Regions are in capture pixels (captures are 2x). Arabic captures are
   mirrored, so their horizontal regions are mirrored too.

   Usage (from apps/web-next): node scripts/crop-visual-proof.mjs */

import path from 'node:path';
import sharp from 'sharp';

const DIR = path.join(process.cwd(), 'public', 'landing', 'proof');

/** name: [source scene, left, top, width, height]; top may differ per locale
    because the Arabic filter chips fit on one row and the list starts higher. */
const CROPS = {
  'hero-chat': ['chat', 0, 0, 760, 800],
  'hero-inbox': ['inbox', 24, { en: 300, ar: 232 }, 672, 262],
  'hero-report': ['report', 40, 490, 1160, 226],
};

for (const locale of ['en', 'ar']) {
  for (const [name, [scene, left, topSpec, width, height]] of Object.entries(CROPS)) {
    const top = typeof topSpec === 'number' ? topSpec : topSpec[locale];
    const source = path.join(DIR, `${scene}-${locale}.webp`);
    const { width: sourceWidth } = await sharp(source).metadata();
    const x = locale === 'ar' ? sourceWidth - left - width : left;
    const out = path.join(DIR, `${name}-${locale}.webp`);
    const info = await sharp(source)
      .extract({ left: x, top, width, height })
      .webp({ quality: 86, effort: 5 })
      .toFile(out);
    console.log(`${name}-${locale}.webp ${info.width}x${info.height} ${info.size} bytes`);
  }
}
