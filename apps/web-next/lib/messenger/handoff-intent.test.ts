import { describe, expect, it } from 'vitest';
import { detectExplicitHandoffRequest, readShopperMessage, type ShopperIntent } from './handoff-intent';
import { DEFAULT_HANDOFF_RULES, routeBeforeModel } from './handoff-rules';

/* v16 phase zero item 10: a labelled table in English, Arabic and Franco.
   Policy questions stay with the assistant; requests about the shopper's own
   order, big orders and asking for a person go to the team; and the
   "someone special" family never does. */

type Row = [message: string, intent: ShopperIntent];

const ENGLISH: Row[] = [
  // Asking for a person
  ['Can I talk to a real person?', 'person'],
  ['I want to speak to customer service', 'person'],
  ['Let me talk to your manager', 'person'],
  ['human please', 'person'],
  ['Is there someone I can talk to?', 'person'],
  ['agent', 'person'],
  ['connect me to a human agent', 'person'],
  // Refund requests
  ['I want a refund for my order', 'refund_request'],
  ['Please refund order #1043', 'refund_request'],
  ["I'd like to return my dress, it doesn't fit", 'refund_request'],
  ['I want my money back', 'refund_request'],
  // Exchange requests
  ['I need to exchange this for a medium', 'exchange_request'],
  ['Can I swap my order for a bigger size?', 'exchange_request'],
  ['I want to change the size of my hoodie', 'exchange_request'],
  // Order changes
  ['Please cancel my order', 'order_change'],
  ['I want to change my delivery address', 'order_change'],
  ['Can I change the address on order 1043?', 'order_change'],
  ['cancel my order please', 'order_change'],
  // Big orders
  ['Do you have 20 pieces of the black hoodie?', 'bulk'],
  ['I want to order 10 of these for my team', 'bulk'],
  ["What's your wholesale price?", 'bulk'],
  // Policy questions
  ['What is your return policy?', 'policy_question'],
  ['How long do exchanges take?', 'policy_question'],
  ['Do you offer refunds?', 'policy_question'],
  ['Can I cancel an order after placing it?', 'policy_question'],
  ['Is return shipping free?', 'policy_question'],
  ['I want to know your exchange policy', 'policy_question'],
  // Look alike, are not
  ['Is this real human hair?', 'other'],
  ["I'm buying a gift for someone special", 'other'],
  ['My travel agent recommended your store', 'other'],
  ['Does the human hair wig come in black?', 'other'],
  ['Someone told me you have a sale', 'other'],
  ['Are you a real person?', 'other'],
  ['What size should I get for 165 cm?', 'other'],
  ['I ordered 2 pieces last week, when will they ship?', 'other'],
  ['What are your customer service hours?', 'other'],
  ['I want to return to the homepage', 'other'],
];

const ARABIC: Row[] = [
  // Asking for a person
  ['عايز اكلم حد من خدمة العملاء', 'person'],
  ['ممكن أتكلم مع موظف؟', 'person'],
  ['أريد التحدث مع موظف من فضلك', 'person'],
  ['عايزة حد حقيقي يرد عليا', 'person'],
  ['خدمة العملاء لو سمحت', 'person'],
  // Refund requests
  ['عايز أرجع الطلب', 'refund_request'],
  ['رجعولي فلوسي', 'refund_request'],
  ['طلبي وصل مضروب وعايزة استرجع فلوسي', 'refund_request'],
  // Exchange requests
  ['عايز أبدل المقاس', 'exchange_request'],
  ['ممكن تبدلولي الطلب بمقاس أكبر؟', 'exchange_request'],
  ['عايزه ابدل الفستان بلون تاني', 'exchange_request'],
  // Order changes
  ['عايز الغي الأوردر', 'order_change'],
  ['ممكن تغيروا عنوان التوصيل بتاعي؟', 'order_change'],
  ['اغير عنواني ازاي؟', 'order_change'],
  ['كنسلوا الاوردر لو سمحت', 'order_change'],
  // Big orders
  ['عايز ١٠ قطع من الهودي ده', 'bulk'],
  ['بكام سعر الجملة؟', 'bulk'],
  ['محتاجة خمسين حتة للفريق بتاعي', 'bulk'],
  // Policy questions
  ['سياسة الاسترجاع ايه؟', 'policy_question'],
  ['الاستبدال بياخد قد ايه؟', 'policy_question'],
  ['ينفع أبدل لو المقاس طلع صغير؟', 'policy_question'],
  ['عايزة اعرف سياسة الاستبدال', 'policy_question'],
  // Look alike, are not
  ['بتشحنوا للإسكندرية؟', 'other'],
  ['عايزة هدية لحد عزيز عليا', 'other'],
  ['الموظف اللي وصل الطلب كان محترم جدا', 'other'],
  ['انت بني ادم ولا بوت؟', 'other'],
  ['الشعر ده طبيعي انسان؟', 'other'],
  ['هل عندكم مقاس أكبر؟', 'other'],
  ['ايه رقم خدمة العملاء؟', 'other'],
];

const FRANCO: Row[] = [
  // Asking for a person
  ['3ayez akalem 7ad men el team', 'person'],
  ['momken akalem customer service?', 'person'],
  ['3ayza 7ad 7a2i2y yerod 3alaya', 'person'],
  ['wasalny b mowazaf law sama7t', 'person'],
  // Refund requests
  ['3ayez araga3 el order', 'refund_request'],
  ['el order wesel ghalat, 3ayza felosy', 'refund_request'],
  ['raga3oly felosy law sama7t', 'refund_request'],
  // Exchange requests
  ['3ayez abadel el size', 'exchange_request'],
  ['momken tbadelholy b size L?', 'exchange_request'],
  ['3ayza a8ayar el ma2as', 'exchange_request'],
  // Order changes
  ['3ayez alghy el order', 'order_change'],
  ['3ayez a8ayar el 3enwan bta3y', 'order_change'],
  ['cancel el order law sama7t', 'order_change'],
  // Big orders
  ['3ayez 20 7etta men el hoodie', 'bulk'],
  ['fe se3r gomla?', 'bulk'],
  ['me7tag khamsa men dah', 'bulk'],
  // Policy questions
  ['el estebdal by5od ad eh?', 'policy_question'],
  ['momken araga3 law el size msh mazbout?', 'policy_question'],
  ['eh el return policy beta3etkom?', 'policy_question'],
  // Look alike, are not
  ['3ayza hadeya l 7ad 3aziz', 'other'],
  ['enta bani adam wala bot?', 'other'],
  ['el sha3r da insan tabe3y?', 'other'],
];

const TEAM_INTENTS = new Set<ShopperIntent>(['person', 'refund_request', 'exchange_request', 'order_change', 'bulk']);

describe('reading a shopper message (phase zero item 10)', () => {
  const table = [...ENGLISH, ...ARABIC, ...FRANCO];

  it('has at least 60 labelled messages across the three scripts', () => {
    expect(table.length).toBeGreaterThanOrEqual(60);
    expect(ENGLISH.length).toBeGreaterThanOrEqual(20);
    expect(ARABIC.length).toBeGreaterThanOrEqual(20);
    expect(FRANCO.length).toBeGreaterThanOrEqual(20);
  });

  it.each(table)('%s → %s', (message, intent) => {
    expect(readShopperMessage(message).intent).toBe(intent);
  });

  it.each(table)('routes %s with the rules on', (message, intent) => {
    const route = routeBeforeModel(readShopperMessage(message).intent, DEFAULT_HANDOFF_RULES, { rulesOn: true });
    expect(route).toBe(TEAM_INTENTS.has(intent) ? 'team' : 'assistant');
  });

  it.each(table)('routes %s with the rules off: only asking for a person reaches the team', (message, intent) => {
    const route = routeBeforeModel(readShopperMessage(message).intent, DEFAULT_HANDOFF_RULES, { rulesOn: false });
    expect(route).toBe(intent === 'person' ? 'team' : 'assistant');
  });

  it('keeps every policy question with the assistant', () => {
    const policy = table.filter(([, intent]) => intent === 'policy_question');
    expect(policy.length).toBeGreaterThanOrEqual(9);
    for (const [message] of policy) {
      expect(routeBeforeModel(readShopperMessage(message).intent, DEFAULT_HANDOFF_RULES, { rulesOn: true })).toBe('assistant');
    }
  });

  it('agrees with detectExplicitHandoffRequest on who asked for a person', () => {
    for (const [message, intent] of table) {
      expect(detectExplicitHandoffRequest(message)).toBe(intent === 'person');
    }
  });

  it('reports the language, Franco told apart from Arabic', () => {
    expect(readShopperMessage('I want a refund for my order').language).toBe('en');
    expect(readShopperMessage('عايز أرجع الطلب').language).toBe('ar');
    expect(readShopperMessage('3ayez 20 7etta men el hoodie').language).toBe('franco');
  });

  it('reads the quantity of one piece, in digits, Arabic digits and words', () => {
    expect(readShopperMessage('Do you have 20 pieces of the black hoodie?').quantity).toBe(20);
    expect(readShopperMessage('عايز ١٠ قطع من الهودي ده').quantity).toBe(10);
    expect(readShopperMessage('محتاجة خمسين حتة').quantity).toBe(50);
    expect(readShopperMessage('me7tag khamsa men dah').quantity).toBe(5);
    // A size, an order number and a height are not quantities.
    expect(readShopperMessage('Do you have size 42 pieces?').quantity).toBeNull();
    expect(readShopperMessage('Where is order 1043?').quantity).toBeNull();
    expect(readShopperMessage('I am 165 cm').quantity).toBeNull();
  });

  it('uses the store\'s own piece count for a big order', () => {
    expect(readShopperMessage('I need 4 pieces', { piecesOfOne: 5 }).intent).toBe('other');
    expect(readShopperMessage('I need 4 pieces', { piecesOfOne: 3 }).intent).toBe('bulk');
  });
});
