/* Reading a shopper's message before the model runs (v16 phase zero item 10).

   A person must be reachable without depending on the model noticing, so
   asking for one is decided here, by phrase, in English, Arabic and Franco.
   The old check matched single words anywhere: "agent", "someone" and
   "human" fired on "human hair" and "a gift for someone special", while
   "customer service", "manager", "خدمة العملاء" and every Franco phrasing
   were missed.

   The same reading finds requests to refund, exchange or change an order,
   and big orders, for the store's handoff rules (N25). A request is an ask
   about the shopper's own order ("I want to return my order"); a question
   about how a policy works ("how long do exchanges take?") stays with the
   assistant. When this reading is unsure it says "other" and the model's
   verdict decides. No server-only import: the labelled table tests it. */

import { normalizeForMatch, shopperLanguage, type ShopperLanguage } from './language';

export type ShopperIntent =
  | 'person'
  | 'refund_request'
  | 'exchange_request'
  | 'order_change'
  | 'bulk'
  | 'policy_question'
  | 'other';

export interface ShopperReading {
  intent: ShopperIntent;
  /** The largest quantity of one piece the message asks about, if any. */
  quantity: number | null;
  language: ShopperLanguage;
}

/* Each list below is a regex alternation over normalizeForMatch output:
   lower case, أ/إ/آ read as ا, ة as ه, ى as ي, Arabic digits as 0-9, and
   words separated by single spaces. */

/** A whole word or phrase, between spaces. */
function word(source: string): string {
  return `(?<=\\s)(?:${source})(?=\\s)`;
}

/** `a`, then up to `gap` words, then `b`. Unless a blocker word sits in the
 *  matched span ("I want to know your return policy"). */
function near(text: string, a: string, b: string, gap: number, blockers?: RegExp): boolean {
  const pattern = new RegExp(`(?<=\\s)(?:${a})(?:\\s\\S+){0,${gap}}?\\s(?:${b})(?=\\s)`, 'gu');
  for (const match of text.matchAll(pattern)) {
    if (!blockers || !blockers.test(` ${match[0]} `)) return true;
  }
  return false;
}

function has(text: string, source: string): boolean {
  return new RegExp(word(source), 'u').test(text);
}

/* ── Asking for a person ─────────────────────────────────────────────── */

const PERSON_VERBS = [
  // English
  String.raw`talk|speak|chat|connect\sme|transfer\sme|put\sme\sthrough|get\sme|pass\sme|reach|contact|escalate`,
  // Arabic
  String.raw`[وف]?(?:اكلم\p{L}{0,2}|نكلم\p{L}{0,2}|كلمني|كلموني|تكلمني|اتكلم|نتكلم|اتواصل|نتواصل|احكي|اتحدث|التحدث|وصلني|وصلوني|توصلني|حولني|حولوني|تحولني)`,
  // Franco
  String.raw`akalem\S{0,3}|akalm\S{0,3}|akallem\S{0,3}|akalim\S{0,3}|kalemny|kallemny|klmny|atkalem|atkalm|atkallem|at7adas|at7ades|atwasal|atwsl|wasalny|wasalni|wasselny|7awelny|7wlny|7awelni|7awlny`,
].join('|');

const PERSON_TARGETS = [
  String.raw`human|person|people|agent|representative|rep|someone|somebody|anyone|anybody|manager|supervisor|staff|team|customer\s(?:service|support|care)|support|employee|operator`,
  String.raw`(?:ال|لل|ل)?(?:حد|احد|شخص|انسان|موظف|موظفه|ممثل|مسؤول|مسيول|مسئول|مدير|فريق|دعم|بشري|ادمن)|خدمه\sالعملاء|بني\s?ادم`,
  String.raw`7ad|7d|insan|ensan|(?:bani|beni|bany)\s?adam|mowazaf|mwazaf|muwazaf|mowazfa|el\s?team|fari2|el\s?fari2|el\s?support|modeer|el\s?modeer|mas2ool|mas2ol|mas2oul`,
].join('|');

const WANT_EN = String.raw`i\s(?:want|wanna|need|would\slike|d\slike|wish)|id\slike|im\s(?:trying|looking)|i\sam\s(?:trying|looking)|please|pls|plz|kindly|let\sme|help\sme|can\syou|could\syou|would\syou|how\s(?:do|can)\si`;
const WANT_AR = String.raw`[وف]?(?:عايز|عاوز|عايزه|عاوزه|عايزين|عاوزين|اريد|نريد|ابغي|ابغا|نبغي|ابي|بدي|حابب|حابه|محتاج|محتاجه|محتاجين|نفسي|ارجو|ياريت)|لو\sسمحت|من\sفضلك|يا\sريت`;
const WANT_FR = String.raw`3ayez|3ayz|3aiz|3ayza|3ayzah|3ayzen|3ayzeen|3awez|3awz|3awza|3awzeen|ayez|3yz|3ayiz|7abb|7abeb|7abba|me7tag|m7tag|mi7tag|me7taga|ne7tag|nefsy|nfsy|law\ssama7t|lw\ssm7t|law\ssm7t|men\sfadlak|mn\sfdlk|yareet|ya\sreet`;
const WANT = [WANT_EN, WANT_AR, WANT_FR].join('|');

/** A person named straight after "I want": "عايز حد", "3ayez mowazaf". */
const WANTED_PERSON = String.raw`حد|موظف|موظفه|شخص|انسان|مسؤول|مسئول|المدير|مدير|ممثل|7ad|mowazaf|mwazaf|insan|ensan|employee|human|person|agent|modeer|el\s?modeer|manager`;

const PERSON_PHRASES = [
  // English
  String.raw`(?<!(?:are|r)\s(?:you|u)\s(?:an?\s)?)(?:real|actual|live)\s(?:person|human(?!\s(?:hair|leather|skin))|agent|people)`,
  String.raw`(?<!(?:are|r)\s(?:you|u)\s(?:an?\s)?)human(?!\s(?:hair|leather|skin))\s(?:agent|being|support|help|please|pls|plz)`,
  String.raw`customer\s(?:service|support|care)(?!\s(?:hours|number|email|phone|whatsapp|policy|times|line))`,
  String.raw`(?:your|the|ur)\s(?:manager|supervisor)`,
  String.raw`(?:someone|somebody|anyone|anybody|a\sperson|a\shuman)\s(?:i\scan|to)\s(?:talk|speak|chat)`,
  String.raw`i\sdont\swant\s(?:\S+\s){0,3}(?:bot|robot|ai)|(?:no|stop)\s(?:more\s)?(?:bots?|robots?)`,
  // Arabic
  String.raw`(?<!(?:رقم|مواعيد|ايميل|تليفون|نمره)\s)(?:ال)?خدمه\sالعملاء`,
  String.raw`(?:شخص|انسان|موظف|حد)\s(?:حقيقي|بشري)`,
  String.raw`(?<!(?:انت|انتي|انتا)\s)بني\s?ادم`,
  String.raw`حد\sمن\s(?:ال)?(?:فريق|الدعم|دعم|خدمه|المحل|المتجر|الشركه|البراند)`,
  String.raw`مش\s(?:عايز|عاوز|عايزه|عاوزه|بدي|ابغي)\s(?:\S+\s){0,2}(?:بوت|روبوت|ذكاء|الي)`,
  // Franco
  String.raw`(?:7ad|insan|ensan)\s7a2[iy]2[iy]`,
  String.raw`(?<!(?:enta|enty|inta|inty|ente)\s)(?:bani|beni|bany)\s?adam`,
  String.raw`7ad\smen\s(?:el\s?)?(?:team|fari2|support|ma7al|shop|store|brand)`,
  String.raw`msh\s(?:3ayez|3ayz|3awez)\s(?:\S+\s){0,2}(?:bot|robot|ai)`,
].join('|');

/** One word that is only ever a request: "human", "agent", "موظف". */
const PERSON_ALONE = /^\s(?:human|agent|person|representative|operator|موظف|انسان|بني\s?ادم|mowazaf|insan|ensan)(?:\s(?:please|pls|plz|لو\sسمحت|من\sفضلك))?\s$/u;

function asksForPerson(text: string): boolean {
  if (PERSON_ALONE.test(text)) return true;
  if (has(text, PERSON_PHRASES)) return true;
  if (near(text, PERSON_VERBS, PERSON_TARGETS, 4)) return true;
  return near(text, WANT, WANTED_PERSON, 1);
}

/* ── Requests about the shopper's own order ──────────────────────────── */

/** Words that turn "I want ... return" into a question about the policy. */
const BLOCKERS = new RegExp(
  word(
    [
      String.raw`know|tell|explain|ask|understand|check|policy|policies|info|information|details`,
      String.raw`[وف]?(?:اعرف|نعرف|افهم|اسال|سياسه|معلومات|تفاصيل|تقولي|تقوللي|تقولولي|تشرح|اقرا)`,
      String.raw`a3raf|a3rf|n3raf|afham|as2al|policy|siasa|seyasa|t2oly|t2olly|t2olaly|tolly|ta2oly|teshra7`,
    ].join('|'),
  ),
  'u',
);

/** The shopper's own order, money or address. */
const MINE = [
  String.raw`my|mine|order\s?#?\d+|#\d+|\d{4,}`,
  String.raw`طلبي|اوردري|(?:الاوردر|الطلب)\sبتاعي|بتاعي|بتاعتي|فلوسي|عنواني|رقم\s(?:ال)?(?:طلب|اوردر)`,
  String.raw`beta3y|bta3y|bta3i|beta3i|bta3ty|beta3ty|ordery|orderi|felosy|flosy|floosy|3enwany|3nwany`,
].join('|');

const REFUND = [
  String.raw`refund(?:ed)?|money\sback|return(?!\sto\s)|send\s(?:it|this|them|these)\sback`,
  String.raw`[وف]?(?:ارجع\p{L}{0,4}|نرجع\p{L}{0,4}|ترجع\p{L}{0,4}|يرجع\p{L}{0,4}|رجعو\p{L}{0,3}|استرجع\p{L}{0,3}|نسترجع\p{L}{0,3}|استرد\p{L}{0,3}|(?:ال)?ارجاع|(?:ال)?استرجاع|(?:ال)?استرداد|فلوسي|فلوسنا|(?:ال)?فلوس)`,
  String.raw`araga3\S{0,4}|arag3\S{0,4}|arga3\S{0,4}|arg3\S{0,4}|aragga3\S{0,4}|raga3\S{0,4}|rag3\S{0,4}|ragga3\S{0,4}|tarag3\S{0,4}|traga3\S{0,4}|astarga3\S{0,3}|asterga3\S{0,3}|astrg3\S{0,3}|esterga3|estergaa|esterdad|refund|felosy|flosy|floosy|feloosy|el\s?flos|el\s?felos`,
].join('|');

const EXCHANGE = [
  String.raw`exchange|swap|replace(?:ment)?|change\s(?:the\s|my\s|it\s(?:to|for)\s|to\s(?:a\s)?)?(?:size|colou?r)`,
  String.raw`[وف]?(?:ابدل\p{L}{0,4}|نبدل\p{L}{0,4}|تبدل\p{L}{0,4}|استبدل\p{L}{0,3}|نستبدل\p{L}{0,3}|(?:ال)?تبديل|(?:ال)?استبدال|(?:اغير|نغير|تغير\p{L}{0,3}|تغيير)\s(?:ال)?(?:مقاس|لون|سايز)\p{L}{0,2})`,
  String.raw`abadel\S{0,4}|abdel\S{0,4}|abadl\S{0,4}|abaddel\S{0,4}|nbadel\S{0,4}|tbadel\S{0,4}|astabdel\S{0,3}|estebdal|estbdal|tabdeel|tabdil|(?:a3ayar|aghayar|aghyar|a8ayar|a8yar|agayar|aghair|ghayar|8ayar)\s(?:el\s?)?(?:size|ma2as|mo2as|lon|loon|color|colour)`,
].join('|');

/** Cancelling needs no object: "I want to cancel" is already a request. */
const CANCEL = [
  String.raw`cancel(?:led|ed|ing|lation)?`,
  String.raw`[وف]?(?:الغي|الغاء|نلغي|تلغي\p{L}{0,3}|اكنسل|كنسل\p{L}{0,3}|نكنسل|تكنسل\p{L}{0,3})`,
  String.raw`alghy|alghi|elghy|elghi|a2la3|acancel|ncancel|cancel\S{0,3}|kansel\S{0,3}`,
].join('|');

/** Changing needs one: "change my address", not "change the size". */
const CHANGE = [
  String.raw`change|update|edit|modify|correct|fix|add\s(?:an?\s|one\s|another\s)?(?:item|piece|something)\sto|remove`,
  String.raw`[وف]?(?:اغير|نغير|تغير\p{L}{0,3}|تغيير|اعدل|نعدل|تعدل\p{L}{0,3}|تعديل|اضيف|اشيل)`,
  String.raw`a3ayar|aghayar|aghyar|a8ayar|a8yar|agayar|aghair|ghayar|a3adel|a3dl|a3del|azawed|ashil`,
].join('|');

const ORDER_THINGS = [
  String.raw`order|address|delivery\saddress|shipping\saddress|phone(?:\snumber)?|delivery\sdate`,
  String.raw`(?:ال)?(?:طلب|اوردر|عنوان|رقم|تليفون|موبايل|هاتف|ميعاد)\p{L}{0,2}`,
  String.raw`(?:el\s?)?(?:order|oredr|ordr|talab|3enwan|3nwan|address|rakam|raqam|nemra|mobile|phone)\S{0,2}`,
].join('|');

/* What a message that opens with the action looks like. Only verb forms
   count, so a noun opening a question ("الاستبدال بياخد قد ايه؟", how long
   does an exchange take?) is not read as an instruction. */
const REFUND_OPENING = String.raw`refund|return|رجعو\p{L}{0,3}|ترجعو\p{L}{0,3}|رجعلي|رجعيلي|raga3o\S*|rag3o\S*|ragga3o\S*|traga3o\S*|tarag3o\S*`;
const EXCHANGE_OPENING = String.raw`exchange|swap|replace|بدلو\p{L}{0,3}|بدلي\p{L}{0,3}|تبدلو\p{L}{0,3}|تبدلي\p{L}{0,3}|badelo\S*|badelholy|tbadel\S*`;
const CANCEL_OPENING = String.raw`cancel|الغي|الغو\p{L}{0,3}|تلغو\p{L}{0,3}|كنسل\p{L}{0,3}|تكنسل\p{L}{0,3}|alghy|elghy|tlghy|cancel\S{0,3}|kansel\S{0,3}`;
const CHANGE_OPENING = String.raw`(?:change|update|edit|غيرو\p{L}{0,3}|تغيرو\p{L}{0,3}|عدلو\p{L}{0,3}|تعدلو\p{L}{0,3}|ghayaro\S*|8ayaro\S*|tghayaro\S*|t8ayaro\S*)(?:\s\S+){0,2}?\s(?:${ORDER_THINGS})`;

/** Polite openers before an instruction, "can you" included. */
const OPENERS = String.raw`please\s|pls\s|kindly\s|لو\sسمحت\s|من\sفضلك\s|law\ssama7t\s|ممكن\s(?=ت)|(?:momken|mmkn)\s(?=t)`;

function requestsAction(text: string, action: string, opening: string): boolean {
  return (
    near(text, WANT, action, 4, BLOCKERS) ||
    near(text, action, MINE, 3, BLOCKERS) ||
    near(text, MINE, action, 3, BLOCKERS) ||
    // A message that opens with the action is an instruction: "refund my
    // order", "كنسلوا الاوردر", "momken tbadelholy".
    new RegExp(`^\\s(?:${OPENERS})?(?:${opening})(?=\\s)`, 'u').test(text)
  );
}

/** "change ... address", within two words. */
const CHANGE_ORDER = `(?:${CHANGE})(?:\\s\\S+){0,2}?\\s(?:${ORDER_THINGS})`;
/** "change my delivery address", "اغير عنواني": the shopper's own already. */
const CHANGE_MY_ORDER = `(?:${CHANGE})\\s(?:\\S+\\s)?(?:${MINE})(?:\\s\\S+)?\\s(?:${ORDER_THINGS})|(?:${CHANGE})\\s(?:طلبي|اوردري|عنواني|رقمي|ordery|orderi|3enwany|3nwany)`;

function requestsOrderChange(text: string): boolean {
  if (requestsAction(text, CANCEL, CANCEL_OPENING) || requestsAction(text, CHANGE_ORDER, CHANGE_OPENING)) return true;
  return new RegExp(word(CHANGE_MY_ORDER), 'u').test(text) && !BLOCKERS.test(text);
}

/* ── Big orders ──────────────────────────────────────────────────────── */

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100, dozen: 12,
  واحد: 1, اتنين: 2, اثنين: 2, تلاته: 3, ثلاثه: 3, اربعه: 4, اربع: 4, خمسه: 5, خمس: 5, سته: 6, ست: 6,
  سبعه: 7, سبع: 7, تمانيه: 8, ثمانيه: 8, تسعه: 9, تسع: 9, عشره: 10, عشر: 10, عشرين: 20, تلاتين: 30,
  ثلاثين: 30, اربعين: 40, خمسين: 50, ميه: 100, مائه: 100, دسته: 12,
  wa7ed: 1, etnen: 2, itnen: 2, talata: 3, arba3a: 4, arb3a: 4, khamsa: 5, '5amsa': 5, setta: 6,
  sab3a: 7, tamanya: 8, tes3a: 9, '3ashara': 10, '3ashra': 10, '3eshreen': 20, '3eshrin': 20,
  talateen: 30, arb3een: 40, khamseen: 50, '5amseen': 50, meya: 100, mia: 100, dasta: 12,
};

const PIECE_WORDS = new Set([
  'pieces', 'piece', 'pcs', 'pc', 'items', 'item', 'units', 'unit', 'dozen', 'dozens', 'pairs', 'pair', 'sets',
  'hoodies', 'hoodie', 'shirts', 'shirt', 'tshirts', 'tshirt', 'dresses', 'dress', 'abayas', 'abaya', 'jackets',
  'jacket', 'jeans', 'pants', 'bags', 'bag', 'boxes',
  'قطعه', 'قطع', 'حته', 'حتت', 'حتات', 'منها', 'منهم', 'عبايه', 'عبايات', 'طقم', 'اطقم', 'بلوزه', 'بلوزات',
  'تيشيرت', 'تيشيرتات', 'تيشرت', 'تيشرتات', 'فستان', 'فساتين', 'شنطه', 'شنط', 'هودي', 'هوديز',
  '7etta', '7eta', '7tta', '7etat', '7etet', '7ett', '7ta', '7etta', 'abayat', 'ta2m', 'hoodiez',
]);

/** "of these", "من دي", "men dah" after a number. */
const OF_WORDS = new Set(['of', 'من', 'men', 'mn']);
const OF_TARGETS = /^(?:them|these|those|this|the|each|your|it|ده|دي|دول|دا|ال\p{L}+|dah|da|de|dy|di|dol|el|elly)$/u;
/** A number after these is a size or a reference, not a quantity. */
const NOT_QUANTITY_BEFORE = new Set(['size', 'مقاس', 'سايز', 'ma2as', 'mo2as', 'رقم', 'number', 'no', 'nemra', 'rakam']);
/** After these, a long number is an order number ("order 1043") and a short
 *  one a quantity ("order 10 of these"). */
const ORDER_WORDS = new Set(['order', 'اوردر', 'طلب']);

const WHOLESALE = [
  String.raw`wholesale|in\sbulk|bulk(?:\s(?:order|orders|price|prices|pricing|discount|buy|purchase))?`,
  String.raw`بالجمله|(?:سعر|اسعار|تاجر|تجار)\s(?:ال)?جمله|كميات|كميه\sكبيره`,
  String.raw`gomla|bel\s?gomla|bl\s?gomla|kmyat|kamyat|kamya\skbera|kmya\skbera`,
].join('|');

function quantityAskedFor(text: string): number | null {
  const words = text.trim().split(' ');
  let largest: number | null = null;
  words.forEach((token, index) => {
    const value = /^\d{1,5}$/.test(token) ? Number(token) : NUMBER_WORDS[token];
    if (value === undefined) return;
    const before = index > 0 ? words[index - 1] : '';
    if (NOT_QUANTITY_BEFORE.has(before) || (ORDER_WORDS.has(before) && token.length >= 3)) return;
    for (let ahead = 1; ahead <= 3 && index + ahead < words.length; ahead += 1) {
      const next = words[index + ahead];
      const counted =
        PIECE_WORDS.has(next) ||
        (OF_WORDS.has(next) && OF_TARGETS.test(words[index + ahead + 1] ?? ''));
      if (counted) {
        largest = Math.max(largest ?? 0, value);
        return;
      }
    }
  });
  return largest;
}

/* ── Questions about a policy ─────────────────────────────────────────── */

const POLICY_TOPICS = [
  String.raw`refund|refunds|return(?!\sto\s)|returns|returning|exchange|exchanges|swap|cancel|cancellation|replace|replacement|policy|policies|warranty|guarantee`,
  String.raw`[وف]?(?:ال|بال|لل)?(?:استرجاع|ارجاع|استرداد|استبدال|تبديل|الغاء|سياسه|ضمان|مرتجع)|[وف]?(?:ارجع|ابدل|نرجع|نبدل|يرجع|يبدل|بتبدلو|بترجعو|بتسترجعو)\p{L}{0,3}`,
  String.raw`estebdal|estbdal|esterga3|estergaa|esterdad|tabdeel|araga3\S*|arga3\S*|abadel\S*|betbadelo|bitbadelo|btbdlo|betraga3o|btrg3o|siasa|seyasa`,
].join('|');

/** Reads one shopper message. `piecesOfOne` is the store's big-order
 *  quantity; below it a quantity is just a quantity. */
export function readShopperMessage(text: string, options: { piecesOfOne?: number } = {}): ShopperReading {
  const normalized = normalizeForMatch(text);
  const language = shopperLanguage(text);
  const quantity = quantityAskedFor(normalized);
  const piecesOfOne = options.piecesOfOne ?? 5;
  const reading = (intent: ShopperIntent): ShopperReading => ({ intent, quantity, language });

  if (asksForPerson(normalized)) return reading('person');
  if (requestsOrderChange(normalized)) return reading('order_change');
  if (requestsAction(normalized, EXCHANGE, EXCHANGE_OPENING)) return reading('exchange_request');
  if (requestsAction(normalized, REFUND, REFUND_OPENING)) return reading('refund_request');
  if ((quantity !== null && quantity >= piecesOfOne) || has(normalized, WHOLESALE)) return reading('bulk');
  if (has(normalized, POLICY_TOPICS)) return reading('policy_question');
  return reading('other');
}

/** The shopper asked for a person: always handed to the team. */
export function detectExplicitHandoffRequest(text: string): boolean {
  return asksForPerson(normalizeForMatch(text));
}
