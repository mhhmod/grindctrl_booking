import type { OrderCard } from './order-card';

/* What the assistant says about an order. Every denial reads the same,
   whatever went wrong: wrong order number, wrong email, another store's
   order, budget exhausted. One sentence, so the chat cannot be used to
   discover which orders or addresses exist. */
export const ORDER_DENIED = {
  en: "I couldn't find an order matching those details. If you'd like, I can bring in the team.",
  ar: 'لم أتمكن من العثور على طلب مطابق لهذه التفاصيل. يمكنني توصيلك بالفريق إذا أردت.',
};
export const ORDER_UNAVAILABLE = {
  en: "I couldn't reach the store's order system just now. The team can check it for you.",
  ar: 'تعذّر الوصول إلى نظام الطلبات الآن. يمكن للفريق التحقق منه نيابةً عنك.',
};

/** The one sentence above a found order's card, from its own data. Arabic
 *  speaks to everyone until N26 lets a store choose a form. */
export function orderFoundLine(card: Pick<OrderCard, 'stage' | 'carrier'>, locale: 'en' | 'ar'): string {
  const ar = locale === 'ar';
  switch (card.stage) {
    case 'preparing':
      return ar ? 'وجدته. لم يُشحن الطلب بعد.' : "Found it. It hasn't shipped yet.";
    case 'on_its_way':
      if (card.carrier) return ar ? `وجدته. الطلب في الطريق مع ${card.carrier}.` : `Found it. It's on its way with ${card.carrier}.`;
      return ar ? 'وجدته. الطلب في الطريق.' : "Found it. It's on its way.";
    case 'out_for_delivery':
      return ar ? 'وجدته. الطلب خرج للتوصيل.' : "Found it. It's out for delivery.";
    case 'delivered':
      return ar ? 'وجدته. تم توصيل الطلب.' : 'Found it. It was delivered.';
    case 'cancelled':
      return ar ? 'وجدته. تم إلغاء هذا الطلب.' : 'Found it. This order was cancelled.';
  }
}
