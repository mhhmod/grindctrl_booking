/* Which store knowledge reaches the model, and how much of it (v16 phase
   zero item 11).

   Grounding used to be recency: the 30 most recently updated entries, cut
   at 1,200 characters each and 6,000 in total, whatever the shopper asked.
   An answer approved last month fell out as soon as a few newer entries
   existed. Now every active entry is ranked against the shopper's message,
   matching approved answers always come first, the character budget goes
   to the passages that match, and every cut is marked.

   A site holds at most 50 entries (knowledge.ts), so ranking runs here
   rather than in Postgres: its full-text search has no Arabic dictionary,
   and nothing in it can tell that "abadel", "أبدل" and "exchange" are the
   same question. A small shared vocabulary does that below. */

import { normalizeForMatch } from './language';

export const KNOWLEDGE_PER_ENTRY_CHARS = 1_200;
export const KNOWLEDGE_TOTAL_CHARS = 6_000;
/** Below this much room an entry is left out rather than cut to a stub. */
const MIN_PLACED_CHARS = 120;
const PASSAGE_CHARS = 320;

export interface RankableEntry {
  id: string;
  title: string;
  content: string;
  source: string;
  updated_at: string;
}

export interface PlacedEntry {
  id: string;
  title: string;
  text: string;
  /** Shortened to fit: the prompt marks it. */
  cut: boolean;
  approved: boolean;
  score: number;
}

export interface KnowledgePlan {
  placed: PlacedEntry[];
  /** Entries with no room left, all of them less relevant than the placed. */
  leftOut: number;
}

/* ── Words ────────────────────────────────────────────────────────────── */

const STOPWORDS = new Set(
  [
    'a an the is are was were be been do does did can could would should will i you we they it this that these those',
    'my your our of to in on at for from with and or but if so what which who how when where why there here me us',
    'have has had am not no yes please hi hello thanks any some about',
    'في من على عن الى الي هل ايه اي انا انت احنا هو هي ده دي دا دول اللي الي ما لا مش يا و او ممكن عايز عاوز عندكم عندك',
    'el ana enta enty e7na howa heya da de dol elly mesh msh ya w aw momken mmkn 3ayez 3ayza fe fi men ma3',
  ]
    .join(' ')
    .split(' '),
);

function stem(word: string): string {
  if (/[؀-ۿ]/.test(word)) {
    let w = word;
    if (w.length > 4) w = w.replace(/^(?:وال|فال|بال|كال|لل|ال)/, '');
    else if (w.length > 3) w = w.replace(/^ال/, '');
    if (w.length > 4 && /^[وفب]/.test(w)) w = w.slice(1);
    if (w.length > 4) w = w.replace(/(?:ات|ين|ون|ها|هم|كم|نا)$/, '');
    else if (w.length > 3) w = w.replace(/[هي]$/, '');
    return w;
  }
  if (!/^[a-z]+$/.test(word) || word.length <= 3) return word;
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (/(?:ss|us)$/.test(word)) return word;
  if (/(?:ches|shes|xes|sses)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3);
  if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/* The same question in three scripts. Each line is one concept; its words
   are normalised and stemmed exactly as message words are. */
const CONCEPTS: Record<string, string> = {
  exchange:
    'exchange swap replace replacement استبدال تبديل ابدل بدل استبدل يبدل نبدل تبدل بتبدلوا abadel badel astabdel estebdal estbdal tabdeel tabdil abdel nbadel',
  return:
    'return returns ارجاع استرجاع ارجع رجع مرتجع ترجيع نرجع يرجع بترجعوا araga3 arga3 raga3 rag3 esterga3 estergaa marga3',
  refund: 'refund refunds reimburse استرداد فلوس فلوسي استرد felos flos felosy flosy esterdad',
  shipping:
    'shipping ship delivery deliver courier shipment شحن توصيل يوصل هيوصل بتشحنوا مندوب sha7n shahn tawseel twseel delivery yewsal hywsal',
  size: 'size sizes sizing fit measurement مقاس مقاسات سايز ma2as ma2asat mo2as',
  price: 'price prices cost سعر اسعار بكام تمن se3r as3ar bkam taman',
  payment: 'pay payment cash card cod instapay fawry visa دفع كاش فيزا كارت انستاباي فوري daf3 edfa3 kart',
  stock: 'stock available availability restock متاح متوفر موجود خلص ستوك mawgood metaha motawafer khels',
  color: 'color colour لون الوان lon loon alwan',
  cancel: 'cancel cancellation الغاء الغي كنسل elghaa alghy elghy kansel',
  days: 'day days week weeks يوم ايام اسبوع yom ayam esbo3',
  warranty: 'warranty guarantee ضمان daman',
  discount: 'discount coupon code promo sale offer خصم كوبون كود عرض تخفيض 5asm khasm',
  branch: 'store branch location visit فرع محل مكان far3 ma7al makan',
  care: 'wash washing care iron غسيل غسل مكوه ghaseel 8aseel',
  material: 'material fabric cotton خامه قماش قطن 5ama khama 2omash 2otn',
  tracking: 'track tracking تتبع tatabo3',
  hours: 'hours open opening مواعيد مفتوح mawa3eed',
};

const CONCEPT_OF = new Map<string, string>();
for (const [concept, words] of Object.entries(CONCEPTS)) {
  for (const raw of words.split(' ')) {
    for (const token of normalizeForMatch(raw).trim().split(' ')) {
      if (token) CONCEPT_OF.set(stem(token), concept);
    }
  }
}

/** The words of a text that can match, each with its concept when it has one. */
export function matchTerms(text: string): Set<string> {
  const out = new Set<string>();
  for (const token of normalizeForMatch(text).trim().split(' ')) {
    if (!token || STOPWORDS.has(token) || token.length < 2) continue;
    const stemmed = stem(token);
    out.add(stemmed);
    const concept = CONCEPT_OF.get(stemmed) ?? CONCEPT_OF.get(token);
    if (concept) out.add(`#${concept}`);
  }
  return out;
}

/* ── Ranking ──────────────────────────────────────────────────────────── */

/** Sentence-sized pieces of an entry, so a long page is matched and cut by
 *  its relevant part rather than its first 1,200 characters. */
function passages(content: string): string[] {
  const sentences = content
    .split(/(?<=[.!?؟。\n])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const out: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (current && current.length + sentence.length + 1 > PASSAGE_CHARS) {
      out.push(current);
      current = '';
    }
    current = current ? `${current} ${sentence}` : sentence;
  }
  if (current) out.push(current);
  return out.length > 0 ? out : [content];
}

function overlap(query: Set<string>, terms: Set<string>, weight: (term: string) => number): number {
  let score = 0;
  for (const term of query) if (terms.has(term)) score += weight(term);
  return score;
}

/** Cut at a word boundary, never mid-word. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const space = slice.lastIndexOf(' ');
  return (space > max * 0.6 ? slice.slice(0, space) : slice).trimEnd();
}

export function planKnowledge(
  entries: RankableEntry[],
  query: string,
  budget: { perEntry?: number; total?: number } = {},
): KnowledgePlan {
  const perEntry = budget.perEntry ?? KNOWLEDGE_PER_ENTRY_CHARS;
  const total = budget.total ?? KNOWLEDGE_TOTAL_CHARS;
  const queryTerms = matchTerms(query);

  const prepared = entries.map((entry) => {
    const parts = passages(entry.content).map((text) => ({ text, terms: matchTerms(text) }));
    return { entry, parts, title: matchTerms(entry.title), all: matchTerms(`${entry.title} ${entry.content}`) };
  });

  // Rarer words count for more: "exchange" in one entry out of fifty says
  // more than "order" in thirty.
  const documentCount = Math.max(prepared.length, 1);
  const weight = (term: string) => {
    const containing = prepared.filter((item) => item.all.has(term)).length;
    return Math.log(1 + documentCount / Math.max(containing, 1));
  };

  const ranked = prepared
    .map((item) => {
      const passageScores = item.parts.map((part) => overlap(queryTerms, part.terms, weight));
      const score = Math.max(0, ...passageScores) + overlap(queryTerms, item.title, weight);
      return { ...item, passageScores, score, approved: item.entry.source === 'approved' };
    })
    .sort(
      (a, b) =>
        Number(b.approved && b.score > 0) - Number(a.approved && a.score > 0) ||
        b.score - a.score ||
        Number(b.approved) - Number(a.approved) ||
        b.entry.updated_at.localeCompare(a.entry.updated_at),
    );

  const placed: PlacedEntry[] = [];
  let used = 0;
  let leftOut = 0;
  for (const item of ranked) {
    const room = Math.min(perEntry, total - used);
    if (room < MIN_PLACED_CHARS) {
      leftOut += 1;
      continue;
    }
    const content = item.entry.content.trim();
    let text: string;
    let cut = false;
    if (content.length <= room) {
      text = content;
    } else if (item.score > 0) {
      // The best-matching passages, read in their original order.
      const order = item.parts
        .map((part, index) => ({ index, score: item.passageScores[index], length: part.text.length }))
        .sort((a, b) => b.score - a.score || a.index - b.index);
      const chosen: number[] = [];
      let length = 0;
      for (const candidate of order) {
        const cost = candidate.length + (chosen.length > 0 ? 3 : 0);
        if (length + cost > room) continue;
        chosen.push(candidate.index);
        length += cost;
      }
      text =
        chosen.length > 0
          ? chosen
              .sort((a, b) => a - b)
              .map((index) => item.parts[index].text)
              .join(' … ')
          : clip(content, room);
      cut = true;
    } else {
      text = clip(content, room);
      cut = true;
    }
    used += text.length;
    placed.push({
      id: item.entry.id,
      title: item.entry.title,
      text,
      cut,
      approved: item.approved,
      score: Math.round(item.score * 100) / 100,
    });
  }
  return { placed, leftOut };
}
