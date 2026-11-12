import type { WireMessage } from '@/components/messenger/MessengerPanel';

/* Fixture data for /dev/sheet-scroll-check. Images are inline SVG so the
   page needs no network; the photos are drawn with real edges and light so
   the on-phone check judges them as a shopper's photo would be judged. */

export const SHEET_STATES = [
  'photo',
  'inapp',
  'session-error',
  'check',
  'check-issue',
  'making',
  'result',
  'result-compare',
  'size',
  'error',
  'challenge',
  'out-of-looks',
  'privacy',
] as const;
export type SheetState = (typeof SHEET_STATES)[number];
export const ALL_STATES = [...SHEET_STATES, 'chat'] as const;
export type FixtureState = (typeof ALL_STATES)[number];

export function isFixtureState(value: string | undefined): value is FixtureState {
  return (ALL_STATES as readonly string[]).includes(value ?? '');
}

function svg(body: string, width = 600, height = 800): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`,
  )}`;
}

// A standing figure against a lit wall with a tiled floor: bright enough and
// full of edges, so it passes the check.
function figure(wall: string, floor: string, skin: string, cloth: string, line: string): string {
  const tiles = Array.from({ length: 12 }, (_, i) => `<path d="M${i * 50} 620 V800" stroke="${line}" stroke-width="3"/>`).join('');
  const rows = Array.from({ length: 4 }, (_, i) => `<path d="M0 ${640 + i * 45} H600" stroke="${line}" stroke-width="3"/>`).join('');
  return (
    `<rect width="600" height="620" fill="${wall}"/><rect y="620" width="600" height="180" fill="${floor}"/>${tiles}${rows}` +
    `<circle cx="300" cy="150" r="62" fill="${skin}"/>` +
    `<path d="M210 250 Q300 205 390 250 L430 610 H170 Z" fill="${cloth}"/>` +
    `<rect x="245" y="600" width="38" height="150" fill="${skin}"/><rect x="317" y="600" width="38" height="150" fill="${skin}"/>`
  );
}

export const PHOTO = svg(figure('#e9e1d3', '#b9ab93', '#c99a74', '#55606e', '#7d705c'));
export const DARK_PHOTO = svg(figure('#15130f', '#0d0c0a', '#2a2018', '#121519', '#1b1813'));
export const LOOK = svg(figure('#e9e1d3', '#b9ab93', '#c99a74', '#1f1d1a', '#7d705c'));
export const PRODUCT_IMAGE = svg(
  '<rect width="600" height="800" fill="#f1ece4"/><path d="M200 120 Q300 80 400 120 L470 720 H130 Z" fill="#1f1d1a"/>' +
    '<path d="M260 120 Q300 170 340 120" stroke="#b08d57" stroke-width="10" fill="none"/>',
);

export const PRODUCT = { handle: 'layla-abaya', name: 'Layla Embroidered Abaya', imageUrl: PRODUCT_IMAGE };
export const LONG_PRODUCT = {
  handle: 'layla-abaya',
  name: 'Layla Embroidered Open-Front Linen Abaya with Hand-Stitched Gold Trim, Long Sleeves and a Matching Belt',
  imageUrl: PRODUCT_IMAGE,
};
export const LONG_PRODUCT_AR = {
  handle: 'layla-abaya',
  name: 'عباية ليلى المطرزة من الكتان بواجهة مفتوحة وتطريز ذهبي يدوي وأكمام طويلة مع حزام مطابق',
  imageUrl: PRODUCT_IMAGE,
};

/* The store's own product for the size picker: a colour it was tried in
   and eight sizes, one sold out. */
export const SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
export const STORE_PRODUCT = {
  options: ['Colour', 'Size'],
  currency: 'EGP',
  variants: SIZES.map((size, index) => ({
    id: String(100 + index),
    title: `Black / ${size}`,
    options: ['Black', size],
    available: size !== 'L',
    price: 325000,
  })),
};
export const TRIED_VARIANT = '103';

/* Thirty messages with long answers, so the thread overflows at any size. */
export function chatMessages(locale: 'en' | 'ar'): WireMessage[] {
  const asks =
    locale === 'ar'
      ? ['هل قميص الكتان الأخضر مقاسه مضبوط؟', 'هل المقاس M متوفر باللون الأخضر؟', 'كم يستغرق الشحن إلى القاهرة؟']
      : ['Does the sage linen shirt run true to size?', 'Is M in stock in sage?', 'How long does shipping to Cairo take?'];
  const answers =
    locale === 'ar'
      ? [
          'قصّته واسعة، فالمقاس M مريح بالفعل والمقاس L أطول وأوسع. إذا كنت بين مقاسين فاختر الأصغر للحصول على قصة أنظف.',
          'نعم، المقاس M متوفر باللون الأخضر الآن، وتبقّت ثلاث قطع فقط في المخزن.',
          'يصل الشحن داخل القاهرة خلال يومين إلى ثلاثة أيام عمل، ويمكنك تتبّع الطلب من رابط التتبع في رسالة التأكيد.',
        ]
      : [
          "It's cut oversized, so M already sits relaxed and L gives a longer, looser fit. If you're between sizes, size down for a cleaner line.",
          'Yes, M is in stock in sage right now, with three left.',
          'Delivery inside Cairo takes two to three working days, and the tracking link in your confirmation email follows it the whole way.',
        ];
  const start = Date.parse('2026-11-11T09:00:00.000Z');
  return Array.from({ length: 30 }, (_, index) => {
    const mine = index % 2 === 0;
    const turn = Math.floor(index / 2) % 3;
    return {
      id: `fixture-${index}`,
      role: mine ? 'user' : 'assistant',
      content: mine ? asks[turn] : answers[turn],
      createdAt: new Date(start + index * 60_000).toISOString(),
      ...(mine ? {} : { author: 'ai' as const, feedback: index > 2 ? ('up' as const) : undefined }),
    } as WireMessage;
  });
}
