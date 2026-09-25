/* The landing story's data, ported from the v15 prototype logic
   (design/prototype/boards/Scroll.dc.html in the site-v15 handoff bundle and
   logic/director11.js). Timings and sizes are the prototype's own. */

export const TABLET_COLUMN = 560;
export const SCENE_ORDER = ['tryon', 'store', 'ops', 'product', 'results'] as const;
export type SceneKey = (typeof SCENE_ORDER)[number];
/** Scroll length of each scene, in viewport heights. */
export const LEN: Record<SceneKey, number> = { tryon: 1.5, store: 1.5, ops: 1.5, product: 2.0, results: 1.5 };
/** Beat positions as fractions of each scene's length. */
export const BEATS: Record<SceneKey, number[]> = {
  tryon: [0, 0.4, 0.7, 1],
  store: [0, 1 / 3, 2 / 3, 1],
  ops: [0, 1 / 3, 2 / 3, 1],
  product: [0, 0.25, 0.5, 0.75, 1],
  results: [0, 1 / 3, 2 / 3, 1],
};
/** Public ids of the scene sections, used for deep links. */
export const SCENE_ID: Record<SceneKey, string> = { tryon: 'try', store: 'store', ops: 'ops', product: 'product', results: 'results' };
export const FRAMES: Array<[SceneKey, string]> = [['tryon', 'A'], ['store', 'S'], ['ops', 'O'], ['product', 'B'], ['results', 'C']];
export const FLAT_END = 0.3;
export const OPS_MS = 720;
export const STEP_MS = 800;
export const STEPS = [13, 15, 10, 13, 11];
export const TRY_END: Array<[number, boolean]> = [[0, false], [1, false], [1, true], [2, false]];

export const LAYOUT = {
  desk: { PERSP: 1800, TILT: 24, GLOW_UP: 260, SHEEN_RUN: 460, X: [0, 338, 612, 860, 1100], S: [1.16, 0.9, 0.78, 0.7, 0.7], O: [1, 0.92, 0.5, 0, 0] },
  phone: { PERSP: 1100, TILT: 22, GLOW_UP: 200, SHEEN_RUN: 380, X: [0, 250, 440, 600, 760], S: [0.86, 0.7, 0.6, 0.55, 0.55], O: [1, 0.85, 0.35, 0, 0] },
} as const;

/* Try-on stage: twelve looks, two for each of six shoppers. */
export const SHOPPERS: Array<[number, number]> = [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11]];
export const PHOTO = ['her', 'his', '', 'his', '', ''] as const;
export const PHOTO_IDX = [0, 1, -1, 2, -1, -1];
export const LOOK_SHOPPER = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5];

export const LOOK_NAMES = ["Sage linen shirt", "Embroidered abaya", "Denim overshirt", "Knit polo", "Sage linen shirt", "Satin midi skirt", "Denim shirt", "Knit polo", "Floral tiered dress", "Straight jeans", "Denim shirt", "Crew sweatshirt"] as const;
export const N_LOOKS = 12;
export const N_SHOPPERS = 6;
export const N_PHOTOS = 3;

export type OpsCase = { name: string; path: number[]; pos: number[]; subs: Array<Record<string, string>>; lines: string[] };
export const OPS: OpsCase[] = [{"name": "Sizing question", "path": [1, 2, 3, 7], "pos": [0, 1, 2, 2, 3, 4], "subs": [{"1": "Is there a size guide?"}, {"2": "Checks store knowledge"}, {"3": "Size guide sent"}, {"3": "Rated helpful"}, {"7": "Closed by AI"}, {}], "lines": ["A shopper asks: Is there a size guide?", "The AI checks what you taught it about sizing.", "It answers with your size guide.", "The shopper rates the answer helpful.", "The dashboard counts it as closed by AI.", "Handled start to finish by the AI."]}, {"name": "Stock question", "path": [1, 2, 4, 5, 6, 7], "pos": [0, 1, 2, 3, 4, 5, 6], "subs": [{"1": "Is M in stock in sage?"}, {"2": "Needs a teammate"}, {"4": "Reason: confirm stock"}, {"5": "A shopper needs you"}, {"6": "Omar · note · reply"}, {"7": "Needed your team"}, {}], "lines": ["A shopper asks: Is M in stock in sage?", "The AI decides a teammate should confirm stock.", "It hands the chat to your team with the reason.", "Your team gets an email: A shopper needs you.", "Omar picks it up, leaves a private note and replies.", "The dashboard counts it under Needed your team.", "The shopper got a person. Your team got the context."]}, {"name": "Photo of an order", "path": [1, 2, 6, 7], "pos": [0, 1, 2, 2, 3, 4], "subs": [{"1": "Sent a photo"}, {"2": "Photo: a torn seam"}, {"6": "Label: Looks damaged"}, {"6": "Omar takes over"}, {"7": "Needed your team"}, {}], "lines": ["A shopper sends a photo of her order.", "The AI reads the photo and notes what it shows.", "Your team sees it with a label: Looks damaged.", "Omar takes over the chat.", "The dashboard counts it under Needed your team.", "The AI labels it. A person decides."]}];
export const OPS_TITLE: Record<number, string> = {"1": "Shopper writes", "2": "AI reads it", "3": "AI answers", "4": "Hands off", "5": "Email alert", "6": "Team inbox", "7": "Dashboard"};
export const OPS_SUB: Record<number, string> = {"1": "Store Chat", "2": "Text and photos", "3": "From store knowledge", "4": "With the reason", "5": "To your team", "6": "Assign · note · reply", "7": "What happened"};
export const OPS_EDGES = ["12", "23", "24", "26", "37", "45", "56", "67"];
export const DAILY = [6, 9, 11, 8, 10, 12, 8];

export type PointerStep = [x: number, y: number, opacity: number, tap: number];
export type PointerPaths = { sfP: PointerStep[]; cvP: PointerStep[]; cuP: PointerStep[]; rpP: PointerStep[]; sfClosed: string };
export const PATHS: { desk: PointerPaths; phone: PointerPaths } = {"desk": {"sfP": [[493, 309, 0, 0], [457, 249, 1, 0], [457, 249, 1, 1], [457, 214, 1, 0], [457, 214, 1, 1], [457, 368, 1, 0], [457, 368, 1, 1], [457, 368, 0, 0], [457, 368, 0, 0], [457, 368, 1, 0], [457, 368, 1, 1], [457, 368, 0, 0], [457, 368, 0, 0]], "cvP": [[363, 388, 0, 0], [327, 328, 0, 0], [327, 328, 0, 0], [327, 328, 0, 0], [327, 328, 1, 0], [327, 328, 1, 1], [327, 328, 0, 0], [327, 328, 0, 0], [474, 286, 1, 0], [474, 286, 1, 1], [583, 321, 1, 0], [583, 321, 1, 1], [583, 321, 0, 0], [583, 321, 0, 0], [583, 321, 0, 0]], "cuP": [[155, 193, 0, 0], [119, 133, 0, 0], [119, 133, 1, 0], [119, 133, 1, 1], [119, 133, 0, 0], [119, 133, 0, 0], [119, 133, 0, 0], [119, 133, 0, 0], [119, 133, 0, 0], [119, 133, 0, 0]], "rpP": [[594, 425, 0, 0], [558, 365, 0, 0], [558, 365, 0, 0], [558, 365, 0, 0], [558, 365, 0, 0], [558, 308, 1, 0], [558, 308, 1, 0], [558, 308, 1, 0], [558, 308, 0, 0], [558, 308, 0, 0], [558, 308, 0, 0]], "sfClosed": "inset(205px 0px calc(100% - 205px) 0px round 14px)"}, "phone": {"sfP": [[246, 247, 0, 0], [210, 187, 1, 0], [210, 187, 1, 1], [147, 187, 1, 0], [147, 187, 1, 1], [147, 374, 1, 0], [147, 374, 1, 1], [147, 374, 0, 0], [147, 374, 0, 0], [147, 374, 1, 0], [147, 374, 1, 1], [147, 374, 0, 0], [147, 374, 0, 0]], "cvP": [[52, 387, 0, 0], [16, 327, 0, 0], [16, 327, 0, 0], [16, 327, 0, 0], [16, 327, 1, 0], [16, 327, 1, 1], [16, 327, 0, 0], [16, 327, 0, 0], [147, 286, 1, 0], [147, 286, 1, 1], [242, 321, 1, 0], [242, 321, 1, 1], [242, 321, 0, 0], [242, 321, 0, 0], [242, 321, 0, 0]], "cuP": [[183, 193, 0, 0], [147, 133, 0, 0], [147, 133, 1, 0], [147, 133, 1, 1], [147, 133, 0, 0], [147, 133, 0, 0], [147, 133, 0, 0], [147, 133, 0, 0], [147, 133, 0, 0], [147, 133, 0, 0]], "rpP": [[261, 434, 0, 0], [225, 374, 0, 0], [225, 374, 0, 0], [225, 374, 0, 0], [225, 374, 0, 0], [225, 348, 1, 0], [225, 348, 1, 0], [225, 348, 1, 0], [225, 348, 0, 0], [225, 348, 0, 0], [225, 348, 0, 0]], "sfClosed": "inset(151px 0px calc(100% - 151px) 0px round 14px)"}};

export type OpsNodeKey = "Chat" | "Ai" | "Know" | "Order" | "Photo" | "Answer" | "Hand" | "Closed" | "Inbox";
export type OpsBeat = { title: string; desc: string; path: OpsNodeKey[]; pos: number[]; subs: Array<Partial<Record<OpsNodeKey, string>>>; extra?: Partial<Record<OpsNodeKey, string>>; counts: number[][] };
export const OPS2: OpsBeat[] = [{"title": "Answers from what you teach it", "desc": "Sizing, delivery and care, from your store knowledge, in Arabic or English.", "path": ["Chat", "Ai", "Know", "Answer", "Closed"], "pos": [0, 1, 2, 3, 4], "subs": [{"Chat": "Is there a size guide?"}, {"Ai": "Sizing question"}, {"Know": "Size guide found"}, {"Answer": "Link sent in chat"}, {"Closed": "Rated helpful"}], "counts": [[39, 26, 11, 0], [39, 26, 11, 0], [39, 26, 11, 0], [39, 26, 11, 0], [39, 27, 11, 0]]}, {"title": "Order status inside the chat", "desc": "Read-only, once the email matches the order. No refunds or edits.", "path": ["Chat", "Ai", "Order", "Answer", "Closed"], "pos": [0, 1, 2, 3, 4], "subs": [{"Chat": "Where is order #1042?"}, {"Ai": "Asks for the email"}, {"Order": "Email matched"}, {"Answer": "Shipped, tracking sent"}, {"Closed": "Closed by AI"}], "counts": [[40, 27, 11, 0], [40, 27, 11, 0], [40, 27, 11, 0], [40, 27, 11, 0], [40, 28, 11, 0]]}, {"title": "Photos read, hard cases handed off", "desc": "The AI describes the photo and hands off with the reason. Your team gets an email.", "path": ["Chat", "Ai", "Photo", "Hand", "Inbox"], "pos": [0, 1, 2, 3, 4], "subs": [{"Chat": "Sent a photo"}, {"Ai": "Reads the photo"}, {"Photo": "Torn seam, damaged"}, {"Hand": "Reason: damaged item"}, {"Inbox": "Email sent to team"}], "counts": [[41, 28, 11, 0], [41, 28, 11, 0], [41, 28, 11, 0], [41, 28, 12, 0], [41, 28, 12, 1]]}, {"title": "Your team takes over", "desc": "Assign it, add a private note, reply with a saved answer. The AI steps back.", "path": ["Hand", "Inbox", "Answer"], "pos": [0, 1, 1, 1, 2], "subs": [{"Hand": "Reason: damaged item"}, {"Inbox": "Assigned to Omar"}, {"Inbox": "Private note added"}, {"Inbox": "Saved reply ready"}, {"Answer": "Omar replied in chat"}], "extra": {"Ai": "Steps back for Omar"}, "counts": [[41, 28, 12, 1], [41, 28, 12, 1], [41, 28, 12, 1], [41, 28, 12, 1], [41, 28, 12, 0]]}];
export const OPS2_KEYS: OpsNodeKey[] = ["Chat", "Ai", "Know", "Order", "Photo", "Answer", "Hand", "Closed", "Inbox"];
export const OPS2_TITLE: Record<OpsNodeKey, string> = {"Chat": "Store Chat", "Ai": "AI agent", "Know": "Store knowledge", "Order": "Shopify orders", "Photo": "Photo reader", "Answer": "Answer in chat", "Hand": "Hand off", "Closed": "Closed by AI", "Inbox": "Team inbox"};
export const OPS2_DEF: Record<OpsNodeKey, string> = {"Chat": "Shopper writes", "Ai": "Reads and decides", "Know": "What you teach it", "Order": "Read-only lookup", "Photo": "Describes the photo", "Answer": "In the same chat", "Hand": "With the reason", "Closed": "No team needed", "Inbox": "Assign, note, reply"};
export const OPS2_EDGE: Array<[OpsNodeKey, OpsNodeKey]> = [["Chat", "Ai"], ["Ai", "Know"], ["Ai", "Order"], ["Ai", "Photo"], ["Know", "Answer"], ["Order", "Answer"], ["Photo", "Hand"], ["Answer", "Closed"], ["Hand", "Inbox"], ["Inbox", "Answer"]];
export const NODE_MARK: Record<OpsNodeKey, string> = {"Chat": "i-chat", "Ai": "i-sparkle", "Know": "i-book", "Order": "l-shopify", "Photo": "i-photo", "Answer": "i-reply", "Hand": "i-handoff", "Closed": "i-check", "Inbox": "i-inbox"};

export const STORE_SCROLL = { desk: [0, 150, 468], phone: [0, 656, 960] };
export const STORE_URL = 'https://grindctrl.myshopify.com';
export const STORE_PATHS = ['/', '/collections/abayas', '/products/riyadh-tie-waist-open-abaya', '/products/riyadh-tie-waist-open-abaya'];

export const PART_NAMES = ["Storefront", "Conversation", "Customer", "Workflow", "Report"];
export const PART_DESC = ["AI try-on on your product pages.", "Store Chat answers from your store knowledge and hands off when needed.", "Name, email and the full thread stay together in your inbox.", "The AI answers or hands off, your team gets an email, and every case lands in the dashboard.", "Store Chat and try-on activity in your dashboard."];

/* The hero chat: a scripted, clearly labelled demo of Store Chat. It never
   calls an AI. Its language is its own (the EN and عربي switch inside the
   panel), independent of the page language. Copy: copy/landing.json,
   heroChatScript. */
export type ChatLang = 'en' | 'ar';
export type ChatKey = 'q1' | 'q2' | 'guide' | 'person' | 'restart';
export type ChatScript = {
  dir: 'ltr' | 'rtl';
  font: string;
  intro: string;
  notice: string;
  powered: string;
  ai: string;
  team: string;
  typing: string;
  connecting: string;
  joined: string;
  inbox: string;
  who: string;
  initial: string;
  needs: string;
  handed: string;
  assigned: string;
  q1: string;
  a1: string;
  q2: string;
  guide: string;
  guideA: string;
  person: string;
  teamA: string;
  chip: Record<ChatKey, string>;
};

export const CHAT: Record<ChatLang, ChatScript> = {
  en: {
    dir: 'ltr',
    font: 'var(--font-sans)',
    intro: 'Ask the store a question. Pick one below.',
    notice: 'Assistant may reply automatically',
    powered: 'Powered by GRINDCTRL. Demo conversation.',
    ai: 'Assistant',
    team: 'Team · Omar',
    typing: 'Typing…',
    connecting: 'Connecting you with our team…',
    joined: 'Our team joined the conversation',
    inbox: 'In your team inbox',
    who: 'Salma',
    initial: 'S',
    needs: 'Needs a reply',
    handed: 'AI handed this off',
    assigned: 'Assigned to Omar',
    q1: "Does the sage linen shirt run true to size? I'm between M and L.",
    a1: "It's cut oversized, so M already sits relaxed and L gives a longer, looser fit. Want a teammate to confirm stock in sage?",
    q2: 'Yes please, is M in stock in sage?',
    guide: 'Is there a size guide?',
    guideA: 'You can check our size guide here to help pick the right fit.',
    person: 'Can I talk to someone from your team?',
    teamA: 'Checked stock: M in sage is available.',
    chip: {
      q1: 'Does it run true to size?',
      q2: 'Yes please, is M in stock?',
      guide: 'Is there a size guide?',
      person: 'Talk to a person',
      restart: 'Start over',
    },
  },
  ar: {
    dir: 'rtl',
    font: 'var(--font-arabic)',
    intro: 'اسأل المتجر سؤالاً. اختر واحداً بالأسفل.',
    notice: 'قد يرد المساعد تلقائياً',
    powered: 'مدعوم من GRINDCTRL. محادثة تجريبية.',
    ai: 'المساعد',
    team: 'الفريق · عمر',
    typing: 'يكتب…',
    connecting: 'جارٍ توصيلك بفريقنا…',
    joined: 'انضم فريقنا إلى المحادثة',
    inbox: 'في صندوق الوارد لدى فريقك',
    who: 'سلمى',
    initial: 'س',
    needs: 'تنتظر رداً',
    handed: 'حوّلها الذكاء الاصطناعي',
    assigned: 'مُسندة إلى عمر',
    q1: 'هل قميص الكتان الأخضر مقاسه مضبوط؟ أنا بين M و L.',
    a1: 'قصّته واسعة، فالمقاس M مريح بالفعل والمقاس L أطول وأوسع. هل تريدين أن يؤكد أحد أعضاء الفريق توفر اللون الأخضر؟',
    q2: 'نعم من فضلك، هل المقاس M متوفر باللون الأخضر؟',
    guide: 'هل يوجد دليل مقاسات؟',
    guideA: 'يمكنك مراجعة دليل المقاسات هنا لمساعدتك على الاختيار.',
    person: 'هل يمكنني التحدث مع أحد من فريقكم؟',
    teamA: 'راجعت المخزون: المقاس M متوفر باللون الأخضر.',
    chip: {
      q1: 'هل مقاسه مضبوط؟',
      q2: 'نعم، هل المقاس M متوفر؟',
      guide: 'هل يوجد دليل مقاسات؟',
      person: 'أريد التحدث مع الفريق',
      restart: 'ابدأ من جديد',
    },
  },
};
