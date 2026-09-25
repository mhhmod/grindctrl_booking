/* The landing story's runtime: its state, the scene scripts and the
   director that paces scrolling. A port of the prototype's logic class and
   director (design/prototype/boards/Scroll.dc.html and
   design/prototype/logic/director11.js), with the production changes from
   02-landing.md: reduced motion and short screens stack the scenes instead
   of pacing them, covered sheets are inert, timers pause while the tab is
   hidden, and hash links land on scenes.

   Per-frame values never go through React. The director writes transforms,
   opacity and clip paths straight to the elements marked data-k, through a
   small cache so an unchanged value is never written twice. React state
   holds only discrete things: the current look, captions, the active tab,
   counters. Views subscribe with useStorySlice so a tick in one scene does
   not re-render the others. */

import {
  BEATS,
  CHAT,
  FLAT_END,
  FRAMES,
  LAYOUT,
  LEN,
  LOOK_SHOPPER,
  OPS,
  OPS2,
  OPS_MS,
  PHOTO,
  SCENE_ORDER,
  SHOPPERS,
  STEPS,
  STEP_MS,
  STORE_SCROLL,
  TABLET_COLUMN,
  TRY_END,
  type ChatKey,
  type ChatLang,
  type SceneKey,
} from './story-data';
import {
  beatDuration,
  buildStops,
  clamp,
  easeIO,
  easeQ,
  keyDirection,
  lerpStops,
  nearestStop,
  r1,
  r2,
  r3,
  r4,
  settleDuration,
  smooth,
  stepTarget,
  STOP_SLOP,
  WheelGate,
  wheelPixels,
  type Beat,
} from './story-rules';
import { PausableTimers } from './story-timers';
import type { StoryLayout } from './story-types';

export type ChatMsg = { id: number; kind: 'user' | 'ai' | 'team' | 'system' | 'handoff' | 'typing'; text?: string };
export type CardState = { on: boolean; n: number; dir: '' | 'down' | 'up' };

export type StoryState = {
  /* try-on stage */
  look: number;
  prev: number;
  swaps: number;
  touched: boolean;
  hover: boolean;
  lock: boolean;
  peekN: number;
  peekDir: '' | 'down' | 'up';
  /* hero chat */
  lang: ChatLang;
  thread: ChatMsg[];
  asked: Partial<Record<ChatKey, boolean>>;
  busy: boolean;
  step: 'start' | 'afterA1' | 'afterGuide' | 'done';
  chatTouched: boolean;
  seq: number;
  /* live store */
  sv: number;
  sPanel: number;
  sScrollI: number;
  sAnn: number;
  sChat: number;
  sCall: boolean;
  /* AI operations */
  ob: number;
  os: number;
  opsN: number;
  /* the product */
  tab: number;
  ps: number;
  prevTab: number;
  prevPs: number;
  tabN: number;
  tabAuto: boolean;
  casePlay: boolean;
  wfScen: number;
  /* results */
  cards: CardState[];
  cIdx: number;
  /** Reduced motion or stacked: every scene shows its end state and nothing replays. */
  still: boolean;
};

export function initialStoryState(lang: ChatLang = 'en'): StoryState {
  return {
    look: 0, prev: -1, swaps: 0, touched: false, hover: false, lock: false, peekN: 0, peekDir: '',
    lang, thread: [], asked: {}, busy: false, step: 'start', chatTouched: false, seq: 0,
    sv: 0, sPanel: 0, sScrollI: 0, sAnn: 0, sChat: 0, sCall: false,
    ob: 0, os: 0, opsN: 0,
    tab: 0, ps: 0, prevTab: -1, prevPs: 0, tabN: 0, tabAuto: true, casePlay: false, wfScen: -1,
    cards: Array.from({ length: 8 }, () => ({ on: false, n: 0, dir: '' as const })),
    cIdx: 0,
    still: false,
  };
}

type Update = Partial<StoryState> | ((s: StoryState) => Partial<StoryState>);

const STORE_STATE: Array<Pick<StoryState, 'sv' | 'sPanel' | 'sScrollI' | 'sAnn' | 'sChat' | 'sCall'>> = [
  { sv: 0, sPanel: 0, sScrollI: 0, sAnn: 0, sChat: 0, sCall: false },
  { sv: 1, sPanel: 0, sScrollI: 0, sAnn: 5, sChat: 2, sCall: false },
  { sv: 2, sPanel: 1, sScrollI: 2, sAnn: 2, sChat: 0, sCall: false },
  { sv: 2, sPanel: 2, sScrollI: 2, sAnn: 2, sChat: 0, sCall: true },
];

type Director = {
  root: HTMLElement;
  k: Record<string, HTMLElement>;
  phone: boolean;
  L: (typeof LAYOUT)['desk'] | (typeof LAYOUT)['phone'];
  secs: Partial<Record<SceneKey, HTMLElement>>;
  live: string;
  tops: Partial<Record<SceneKey, number>>;
  raf: number;
  cur: Record<string, number>;
  tgt: Record<string, number>;
  last: Record<string, string>;
  force: boolean;
  vw: number;
  vh: number;
  beats: Beat[];
  stops: number[];
  restY: number;
  beat: number;
  capWant: number;
  capLine: number;
  ptr: number;
  tapN: number;
  chat: boolean;
  flips: string;
  cpos: number;
  upto: number;
  dataA: string;
  anim: boolean;
  tw: number;
  settleT: ReturnType<typeof setTimeout> | undefined;
  hold: number;
  navAct: number;
  touching: boolean;
  tStart: { x: number; y: number } | null;
  tMode: 'x' | 'story' | 'page' | null;
  tDy: number;
  noClickUntil: number;
  lastStore: number;
  inert: string;
  pinned: boolean | null;
  /* measured geometry */
  fitA: number;
  capY: number;
  y0: number;
  y1: number;
  fitS: number;
  fitO: number;
  fitB: number;
  fitC: number;
  cy: number;
  ky: number;
  ty: number;
  spread: number;
};

export type StoryEnv = {
  layout: StoryLayout;
  /** No pacing: scenes are ordinary stacked sections. Reduced motion or a short screen. */
  stacked: boolean;
  reduce: boolean;
  rtl: boolean;
};

export type StoryCallbacks = {
  /** The scene the header should mark as current, or -1. */
  onScene?: (index: number) => void;
};

export class StoryController {
  state: StoryState;
  env: StoryEnv;
  callbacks: StoryCallbacks = {};
  menuOpen = false;
  mounted = false;

  private listeners = new Set<() => void>();
  private d: Director | null = null;
  private beatTimers = new PausableTimers();
  private chatTimers = new PausableTimers();
  private wheel = new WheelGate();
  private tapTimer: ReturnType<typeof setTimeout> | undefined;
  private sTapTimer: ReturnType<typeof setTimeout> | undefined;
  private lateMeasure: ReturnType<typeof setTimeout> | undefined;
  private arriveT: ReturnType<typeof setTimeout> | undefined;
  private inputOn = false;
  private io: IntersectionObserver | null = null;
  private chatIo: IntersectionObserver | null = null;
  private hidden = false;
  private savedScrollBehavior = '';

  constructor(env: StoryEnv, lang: ChatLang) {
    this.env = env;
    this.state = { ...initialStoryState(lang), still: env.stacked };
  }

  /* ---------------------------------------------------------------- store */
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getState = () => this.state;

  setState(update: Update) {
    const patch = typeof update === 'function' ? update(this.state) : update;
    let changed = false;
    for (const key of Object.keys(patch) as Array<keyof StoryState>) {
      if (this.state[key] !== patch[key]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  /* ---------------------------------------------------------------- lifecycle */
  setCallbacks(callbacks: StoryCallbacks) {
    this.callbacks = callbacks;
  }

  /** While the phone menu is open, the story ignores input. */
  setMenuOpen(open: boolean) {
    this.menuOpen = open;
  }

  /** Starts listening and measuring. Call after the views are in the DOM. */
  mount(root: HTMLElement, env: StoryEnv) {
    this.mounted = true;
    this.env = env;
    if (env.stacked) this.setState({ still: true });
    this.inputMount();
    this.directorMount(root);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  unmount() {
    this.mounted = false;
    this.inputUnmount();
    this.directorUnmount();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.chatTimers.clear();
    clearTimeout(this.tapTimer);
    clearTimeout(this.sTapTimer);
    delete document.documentElement.dataset.story;
  }

  /** The layout, language or stacking changed: measure again and stay on the same beat. */
  relayout(root: HTMLElement, env: StoryEnv, { restartChat }: { restartChat?: ChatLang } = {}) {
    const at = this.d ? this.d.beat : -1;
    const y = window.scrollY || 0;
    const stackedChanged = env.stacked !== this.env.stacked;
    this.env = env;
    if (restartChat) this.resetChat(restartChat);
    if (stackedChanged) this.setState({ still: env.stacked || env.reduce });
    this.directorUnmount();
    this.directorMount(root, { keepBeat: at, fallbackY: y });
  }

  private onVisibility = () => {
    const hidden = document.visibilityState === 'hidden';
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    const root = this.d?.root;
    if (hidden) {
      this.beatTimers.pause();
      this.chatTimers.pause();
      if (root) root.dataset.paused = '';
    } else {
      this.beatTimers.resume();
      this.chatTimers.resume();
      if (root) delete root.dataset.paused;
    }
  };

  /* ---------------------------------------------------------------- director */
  private st(k: string, prop: string, val: string) {
    const d = this.d;
    const el = d?.k[k];
    if (!d || !el) return;
    const key = `${k}|${prop}`;
    if (d.last[key] === val) return;
    d.last[key] = val;
    el.style.setProperty(prop, val);
  }

  private offsetIn(el: HTMLElement, root: HTMLElement): [number, number] | null {
    let x = 0;
    let y = 0;
    let e: HTMLElement | null = el;
    while (e && e !== root) {
      x += e.offsetLeft;
      y += e.offsetTop;
      e = e.offsetParent as HTMLElement | null;
    }
    return e === root ? [x, y] : null;
  }

  private directorMount(root: HTMLElement, opts: { keepBeat?: number; fallbackY?: number } = {}) {
    const phone = this.env.layout === 'phone';
    const k: Record<string, HTMLElement> = {};
    root.querySelectorAll<HTMLElement>('[data-k]').forEach((el) => {
      k[el.getAttribute('data-k') as string] = el;
    });
    const secs: Partial<Record<SceneKey, HTMLElement>> = {};
    SCENE_ORDER.forEach((key) => {
      const el = root.querySelector<HTMLElement>(`[data-scene="${key}"]`);
      if (el) secs[key] = el;
    });
    this.d = {
      root, k, phone, L: LAYOUT[phone ? 'phone' : 'desk'], secs,
      live: '', tops: {}, raf: 0, cur: {}, tgt: {}, last: {}, force: true, vw: 1, vh: 1,
      beats: [], stops: [], restY: 1e9, beat: -1, capWant: 0, capLine: -1,
      ptr: -1, tapN: 0, chat: false, flips: '', cpos: 0, upto: -1, dataA: '',
      anim: false, tw: 0, settleT: undefined, hold: 0, navAct: -2,
      touching: false, tStart: null, tMode: null, tDy: 0, noClickUntil: 0, lastStore: -1, inert: '', pinned: null,
      fitA: 1, capY: 0, y0: 0, y1: 0, fitS: 1, fitO: 1, fitB: 1, fitC: 1, cy: 0, ky: 0, ty: 0, spread: 1,
    };
    root.toggleAttribute('data-stacked', this.env.stacked);
    this.savedScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onResize);
    this.directorMeasure();
    if (this.env.stacked) this.showEndStates();
    const keep = opts.keepBeat ?? -1;
    if (!this.env.stacked && keep >= 0 && keep < this.d.stops.length) {
      window.scrollTo(0, this.d.stops[keep]);
      this.d.beat = -1;
      this.enterBeat(keep, false);
    } else if (opts.fallbackY !== undefined) {
      window.scrollTo(0, opts.fallbackY);
    }
    this.kick(true);
    this.lateMeasure = setTimeout(() => {
      if (!this.d) return;
      this.directorMeasure();
      this.kick(true);
    }, 700);
    document.fonts?.ready
      .then(() => {
        if (!this.d) return;
        this.directorMeasure();
        this.kick(true);
      })
      .catch(() => {});
    if (opts.keepBeat === undefined) {
      this.arriveT = setTimeout(() => {
        if (!this.applyHash(window.location.hash, true)) this.settle();
      }, 120);
    }
    window.addEventListener('hashchange', this.onHash);
    this.revealMount(root);
  }

  private revealMount(root: HTMLElement) {
    root.toggleAttribute('data-reveal-on', !this.env.reduce && typeof IntersectionObserver !== 'undefined');
    if (typeof IntersectionObserver === 'undefined') return;
    if (!this.env.reduce) {
      this.io = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting) {
              en.target.setAttribute('data-in', '');
              this.io?.unobserve(en.target);
            }
          });
        },
        { threshold: 0.08 },
      );
      root.querySelectorAll('[data-reveal]').forEach((el) => this.io?.observe(el));
    }
    const chat = root.querySelector('[data-chat-scene]');
    if (chat) {
      this.chatIo = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting) {
              this.startChat();
              this.chatIo?.disconnect();
            }
          });
        },
        { threshold: 0.35 },
      );
      this.chatIo.observe(chat);
    }
  }

  private directorUnmount() {
    const d = this.d;
    this.clearBeat();
    if (!d) return;
    cancelAnimationFrame(d.raf);
    cancelAnimationFrame(d.tw);
    clearTimeout(d.settleT);
    clearTimeout(this.lateMeasure);
    clearTimeout(this.arriveT);
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('hashchange', this.onHash);
    this.io?.disconnect();
    this.io = null;
    this.chatIo?.disconnect();
    this.chatIo = null;
    document.documentElement.style.scrollBehavior = this.savedScrollBehavior;
    this.d = null;
  }

  private onResize = () => {
    const d = this.d;
    if (!d) return;
    const at = d.beat;
    this.directorMeasure();
    if (!this.env.stacked && at >= 0 && at < d.stops.length && !d.anim) window.scrollTo(0, d.stops[at]);
    this.kick(true);
  };

  /** The viewport height the sheets use (100svh), measured from a probe so it matches the CSS. */
  private viewportHeight(phone: boolean) {
    const probe = this.d?.k.vhProbe;
    const h = probe?.offsetHeight || window.innerHeight || (phone ? 844 : 900);
    return this.env.stacked ? Math.max(h, phone ? 700 : 820) : h;
  }

  private directorMeasure() {
    const d = this.d;
    if (!d) return;
    const K = d.k;
    const phone = d.phone;
    const rawVw = window.innerWidth || (phone ? 390 : 1440);
    /* Tablets use the phone layout in a 560px column. */
    const vw = phone ? Math.min(rawVw, TABLET_COLUMN) : rawVw;
    const vh = this.viewportHeight(phone);
    d.vw = vw;
    d.vh = vh;
    const heroH = K.hero ? K.hero.offsetHeight : 520;
    const stageH = K.stage ? K.stage.offsetHeight : 520;
    const cardH = K.card0 ? K.card0.offsetHeight : 450;
    const headC = K.chead ? K.chead.offsetHeight : 134;
    const bH = K.bblock ? K.bblock.offsetHeight : 740;
    const oH = K.oblock ? K.oblock.offsetHeight : 660;
    const sH = K.sblock ? K.sblock.offsetHeight : 770;
    let sy: number;
    let oy: number;
    let by: number;
    if (!phone) {
      d.fitA = clamp(Math.min((vw - 170) / 1100, (vh - 246) / stageH), 0.45, 1.12);
      const capH = 90;
      const block = capH + 26 + stageH * d.fitA;
      d.capY = 84 + Math.max(8, (vh - 84 - 22 - block) / 2);
      d.y1 = d.capY + capH + 26;
      d.y0 = Math.max(heroH + 44, vh * 0.6);
      d.fitS = clamp(Math.min((vw - 256) / 1200, (vh - 104) / sH), 0.45, 1.12);
      sy = 86 + Math.max(0, (vh - 86 - 18 - sH * d.fitS) / 2);
      d.fitO = clamp(Math.min((vw - 256) / 1200, (vh - 104) / oH), 0.45, 1.12);
      oy = 86 + Math.max(0, (vh - 86 - 18 - oH * d.fitO) / 2);
      d.fitB = clamp(Math.min((vw - 256) / 1200, (vh - 104) / bH), 0.45, 1.12);
      by = 86 + Math.max(0, (vh - 86 - 18 - bH * d.fitB) / 2);
      d.cy = 96;
      d.ky = d.cy + headC + 20;
      d.fitC = clamp((vh - d.ky - 34 - 52) / (cardH * 1.16), 0.45, 1.12);
      d.ty = d.ky + 34 + (cardH * 1.16 * d.fitC) / 2;
      d.spread = clamp(vw / 1440, 0.7, 1.15);
    } else {
      const top = 94;
      d.fitA = clamp(Math.min((vw - 40) / 350, (vh - top - 96 - 20) / stageH), 0.45, 1);
      d.capY = top;
      d.y1 = top + 98;
      d.y0 = Math.max(heroH + 18, vh * 0.62);
      d.fitS = clamp(Math.min((vw - 24) / 350, (vh - top - 14) / sH), 0.45, 1.1);
      sy = top + Math.max(0, (vh - top - 14 - sH * d.fitS) / 2);
      d.fitO = clamp(Math.min((vw - 24) / 350, (vh - top - 14) / oH), 0.45, 1.1);
      oy = top + Math.max(0, (vh - top - 14 - oH * d.fitO) / 2);
      d.fitB = clamp(Math.min((vw - 24) / 350, (vh - top - 14) / bH), 0.45, 1.1);
      by = top + Math.max(0, (vh - top - 14 - bH * d.fitB) / 2);
      d.cy = top;
      d.ky = d.cy + headC + 14;
      d.fitC = clamp((vh - d.ky - 30 - 36) / (cardH * 0.86), 0.45, 1.1);
      d.ty = d.ky + 30 + (cardH * 0.86 * d.fitC) / 2;
      d.spread = clamp(vw / 390, 0.8, 1.3);
    }
    if (this.env.stacked) {
      /* Stacked: the hero stays up and the stage sits flat under it. */
      d.y1 = heroH + (phone ? 20 : 36);
      this.st('sheetA', 'height', `${r1(d.y1 + stageH * d.fitA + (phone ? 48 : 72))}px`);
      this.st('sheetS', 'height', `${r1(Math.max(vh, sy + sH * d.fitS + 40))}px`);
      this.st('sheetO', 'height', `${r1(Math.max(vh, oy + oH * d.fitO + 40))}px`);
      this.st('sheetB', 'height', `${r1(Math.max(vh, by + bH * d.fitB + 40))}px`);
      this.st('sheetC', 'height', `${r1(Math.max(vh, d.ty + (cardH * (phone ? 0.86 : 1.16) * d.fitC) / 2 + 70))}px`);
    } else {
      ['sheetA', 'sheetS', 'sheetO', 'sheetB', 'sheetC'].forEach((key) => {
        const el = K[key];
        if (el) el.style.removeProperty('height');
        delete d.last[`${key}|height`];
      });
    }
    this.st('sblock', 'transform', `translate3d(0, ${r1(sy)}px, 0) scale(${r4(d.fitS)})`);
    this.st('oblock', 'transform', `translate3d(0, ${r1(oy)}px, 0) scale(${r4(d.fitO)})`);
    this.st('bblock', 'transform', `translate3d(0, ${r1(by)}px, 0) scale(${r4(d.fitB)})`);
    this.st('chead', 'transform', `translate3d(0, ${r1(d.cy)}px, 0)`);
    this.st('counter', 'transform', `translate3d(0, ${r1(d.ky)}px, 0)`);
    this.st('track', 'transform', `translate3d(0, ${r1(d.ty)}px, 0)`);
    for (let i = 0; i < 8; i++) this.st(`card${i}`, 'top', `${r1(-cardH / 2)}px`);
    const scrollY = window.scrollY || 0;
    const beats: Beat[] = [];
    d.root.querySelectorAll<HTMLElement>('[data-beat]').forEach((el) => {
      const p = (el.getAttribute('data-beat') as string).split(':');
      beats.push({ scene: p[0], i: +p[1], y: Math.round(el.getBoundingClientRect().top + scrollY) });
    });
    d.restY = K.rest ? Math.round(K.rest.getBoundingClientRect().top + scrollY) : 1e9;
    const built = buildStops(beats, d.restY);
    d.beats = built.beats;
    d.stops = this.env.stacked ? [] : built.stops;
    d.ptr = -2;
    this.setGallery(d.cpos, d.upto);
  }

  private kick(force: boolean) {
    const d = this.d;
    if (!d) return;
    if (force) d.force = true;
    if (!d.raf) d.raf = requestAnimationFrame(this.tick);
  }

  private tick = () => {
    const d = this.d;
    if (!d) return;
    d.raf = 0;
    SCENE_ORDER.forEach((key) => {
      const el = d.secs[key];
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const T = LEN[key] * d.vh;
      d.tops[key] = top;
      d.tgt[`p${key}`] = this.env.stacked ? 1 : clamp(-top / T, 0, 1);
      d.tgt[`o${key}`] = this.env.stacked ? 0 : clamp((-top - T) / d.vh, 0, 1);
    });
    d.tgt.rest = clamp(((window.scrollY || 0) - (d.restY - d.vh)) / (0.6 * d.vh), 0, 1);
    const a = this.env.reduce || d.force ? 1 : 0.3;
    let moving = false;
    Object.keys(d.tgt).forEach((key) => {
      const c = d.cur[key] === undefined ? d.tgt[key] : d.cur[key];
      let n = c + (d.tgt[key] - c) * a;
      if (Math.abs(d.tgt[key] - n) < 0.0005) n = d.tgt[key];
      else moving = true;
      d.cur[key] = n;
    });
    d.force = false;
    this.envLive();
    this.apply();
    if (moving) d.raf = requestAnimationFrame(this.tick);
  };

  private apply() {
    const d = this.d;
    if (!d) return;
    const c = d.cur;
    const L = d.L;
    const stacked = this.env.stacked;
    const reduce = this.env.reduce || stacked;
    const pA = c.ptryon || 0;
    const oA = c.otryon || 0;
    const pS = c.pstore || 0;
    const oS = c.ostore || 0;
    const pO = c.pops || 0;
    const oO = c.oops || 0;
    const pB = c.pproduct || 0;
    const oB = c.oproduct || 0;
    const pC = c.presults || 0;
    /* scene 1: the stage lies back under the headline and turns flat */
    const fr = clamp(pA / FLAT_END, 0, 1);
    const flat = reduce ? 1 : easeIO(fr);
    const hero = stacked ? 1 : 1 - smooth(0.02, 0.17, pA);
    const sy = stacked ? d.y1 : d.y0 + (d.y1 - d.y0) * flat;
    this.st('ghosts', 'opacity', r3(hero));
    this.st('floor', 'opacity', r3(1 - flat));
    this.st('cue', 'opacity', r3(stacked ? 0 : 1 - smooth(0, 0.08, pA)));
    this.st('glow', 'transform', `translate3d(0, ${r1(sy - L.GLOW_UP)}px, 0)`);
    this.st('glow', 'opacity', r3(0.5 + 0.5 * flat));
    this.st('hero', 'opacity', r3(hero));
    this.st('hero', 'transform', `translate3d(0, ${r1(-(1 - hero) * 70)}px, 0)`);
    this.st('stage', 'opacity', r3(this.env.reduce && !stacked ? smooth(0.1, 0.2, pA) : 1));
    this.st(
      'stage',
      'transform',
      `translate3d(0, ${r1(sy)}px, 0) perspective(${L.PERSP}px) rotateX(${r2((1 - flat) * L.TILT)}deg) scale(${r4(d.fitA * (0.92 + 0.08 * flat))})`,
    );
    const cap = stacked ? 0 : smooth(0.16, 0.27, pA);
    this.st('cap', 'opacity', r3(cap));
    this.st('cap', 'transform', `translate3d(0, ${r1(d.capY + (1 - cap) * 24)}px, 0)`);
    const line = pA < 0.12 ? 0 : Math.max(1, d.capWant || 0);
    if (line !== d.capLine) {
      d.capLine = line;
      for (let i = 1; i <= 4; i++) {
        this.st(`cap${i}`, 'opacity', i === line ? '1' : '0');
        this.st(`cap${i}`, 'transform', `translateY(${i === line ? 0 : i < line ? -12 : 12}px)`);
        this.st(`dot${i}`, 'opacity', i <= line ? '1' : '0.22');
      }
    }
    this.st('sheen', 'opacity', r3(reduce ? 0 : smooth(0.45, 0.62, fr) * (1 - smooth(0.9, 1, fr))));
    this.st('sheenBand', 'transform', `translate3d(${r1(-120 + smooth(0.5, 1, fr) * L.SHEEN_RUN)}%, 0, 0) skewX(-16deg)`);
    const dataA = hero > 0.5 ? 'hero' : 'steps';
    if (dataA !== d.dataA) {
      d.dataA = dataA;
      d.root.setAttribute('data-a', dataA);
    }
    /* each next scene arrives as a sheet; the one below sinks back */
    this.recedeTo('A', oA);
    this.sheetIn('S', oA);
    this.recedeTo('S', oS);
    this.sheetIn('O', oS);
    this.recedeTo('O', oO);
    this.sheetIn('B', oO);
    this.recedeTo('B', oB);
    this.sheetIn('C', oB);
    /* rail, phone progress and the header's current item */
    const vis = stacked ? 0 : smooth(0.2, 0.3, pA) * (1 - (c.rest || 0));
    const fills = [clamp((pA - FLAT_END) / (1 - FLAT_END), 0, 1), pS, pO, pB, pC];
    const at = oB > 0.5 ? 4 : oO > 0.5 ? 3 : oS > 0.5 ? 2 : oA > 0.5 ? 1 : 0;
    const ink = at === 2 && vis > 0 ? 'var(--gc-cream)' : 'var(--foreground)';
    this.st('rail', 'opacity', r3(vis));
    this.st('rail', 'transform', `translate3d(${r1((1 - vis) * 14 * (this.env.rtl ? -1 : 1))}px, -50%, 0)`);
    this.st('rail', 'visibility', vis > 0.01 ? 'visible' : 'hidden');
    this.st('rail', 'color', ink);
    this.st('prog', 'opacity', r3(vis));
    this.st('prog', 'color', ink);
    for (let i = 0; i < 5; i++) {
      this.st(`rf${i}`, 'transform', `scaleY(${r3(fills[i])})`);
      this.st(`pf${i}`, 'transform', `scaleX(${r3(fills[i])})`);
      this.st(`rn${i}`, 'opacity', i === at ? '1' : '0.45');
    }
    const navAt = vis > 0.4 ? at : -1;
    if (navAt !== d.navAct) {
      d.navAct = navAt;
      this.callbacks.onScene?.(navAt);
    }
    this.syncInert();
    this.syncPinned();
  }

  private recedeTo(key: string, t: number) {
    const x = this.env.reduce || this.env.stacked ? 0 : t;
    this.st(`rec${key}`, 'transform', `scale(${r4(1 - 0.06 * x)})`);
    this.st(`rec${key}`, 'border-radius', `${r1(x * 30)}px`);
    this.st(`dim${key}`, 'opacity', r3(x * 0.26));
  }

  private sheetIn(key: string, t: number) {
    const arrived = this.env.stacked ? 1 : t;
    const r = r1((1 - arrived) * 30);
    this.st(`sheet${key}`, 'border-radius', `${r}px ${r}px 0 0`);
    this.st(`env${key}`, 'clip-path', `inset(0 round ${r}px ${r}px 0 0)`);
    this.st(`sheet${key}`, 'box-shadow', `0 -34px 80px -46px rgb(32 29 27 / ${r3(0.6 * (1 - arrived))})`);
  }

  /** Sheets that are fully covered or off screen take no focus. */
  private syncInert() {
    const d = this.d;
    if (!d) return;
    if (this.env.stacked) {
      if (d.inert !== '') {
        d.inert = '';
        FRAMES.forEach(([, key]) => d.k[`sheet${key}`]?.removeAttribute('inert'));
      }
      return;
    }
    const restTop = d.restY - (window.scrollY || 0);
    let sig = '';
    FRAMES.forEach(([scene], i) => {
      const top = d.tops[scene];
      const covered = (d.tgt[`o${scene}`] ?? 0) >= 0.999 || (i === FRAMES.length - 1 && restTop <= 0);
      const below = top !== undefined && top >= d.vh;
      sig += covered || below ? '1' : '0';
    });
    if (sig === d.inert) return;
    d.inert = sig;
    FRAMES.forEach(([, key], i) => {
      const el = d.k[`sheet${key}`];
      if (!el) return;
      if (sig[i] === '1') el.setAttribute('inert', '');
      else el.removeAttribute('inert');
    });
  }

  /** While the story is pinned the site assistant launcher steps aside. */
  private syncPinned() {
    const d = this.d;
    if (!d) return;
    const pinned = !this.env.stacked && (window.scrollY || 0) < d.restY - 3;
    if (pinned === d.pinned) return;
    d.pinned = pinned;
    if (pinned) document.documentElement.dataset.story = 'pinned';
    else delete document.documentElement.dataset.story;
  }

  private envLive() {
    const d = this.d;
    if (!d) return;
    const vh = d.vh;
    const T = d.tops;
    const restTop = d.restY - (window.scrollY || 0);
    let live = '';
    FRAMES.forEach(([scene, key], i) => {
      const top = T[scene];
      if (top === undefined) return;
      const next = i + 1 < FRAMES.length ? T[FRAMES[i + 1][0]] : restTop;
      if (top < vh && (next === undefined || next > 0)) live += key;
    });
    if (restTop < vh) live += 'R';
    if (live === d.live) return;
    d.live = live;
    ['A', 'S', 'O', 'B', 'C', 'R'].forEach((key) => {
      const el = d.k[`env${key}`];
      if (!el) return;
      if (live.includes(key)) el.setAttribute('data-live', '');
      else el.removeAttribute('data-live');
    });
  }

  /* ---------------------------------------------------------------- paced input: one gesture, one beat */
  private inputMount() {
    if (this.inputOn) return;
    this.inputOn = true;
    window.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('touchstart', this.onTouchStart, { passive: true });
    window.addEventListener('touchmove', this.onTouchMove, { passive: false });
    window.addEventListener('touchend', this.onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', this.onTouchEnd, { passive: true });
    window.addEventListener('click', this.onClickCapture, true);
  }

  private inputUnmount() {
    if (!this.inputOn) return;
    this.inputOn = false;
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('touchstart', this.onTouchStart);
    window.removeEventListener('touchmove', this.onTouchMove);
    window.removeEventListener('touchend', this.onTouchEnd);
    window.removeEventListener('touchcancel', this.onTouchEnd);
    window.removeEventListener('click', this.onClickCapture, true);
  }

  private onClickCapture = (e: MouseEvent) => {
    const d = this.d;
    if (d && performance.now() < d.noClickUntil) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  /** Whether input at this scroll position belongs to the story. */
  private controlled(dy: number) {
    const d = this.d;
    if (!d || !d.stops.length || this.menuOpen || this.env.stacked) return false;
    const y = window.scrollY || 0;
    if (y < d.restY - 3) return true;
    return y <= d.restY + 3 && dy < 0;
  }

  private onWheel = (e: WheelEvent) => {
    const d = this.d;
    if (!d || e.ctrlKey) return;
    const dy = wheelPixels(e.deltaY, e.deltaMode, d.vh);
    if (Math.abs(dy) < Math.abs(e.deltaX)) return;
    if (!this.controlled(dy)) return;
    e.preventDefault();
    const dir = this.wheel.feed(dy, performance.now(), d.anim);
    if (dir) this.step(dir);
  };

  private onKey = (e: KeyboardEvent) => {
    const d = this.d;
    if (!d) return;
    const dir = keyDirection(e);
    if (!dir || !this.controlled(dir)) return;
    e.preventDefault();
    if (!d.anim) this.step(dir);
  };

  private onTouchStart = (e: TouchEvent) => {
    const d = this.d;
    if (!d) return;
    if (!e.touches || e.touches.length !== 1) {
      d.tStart = null;
      return;
    }
    d.tStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    d.tDy = 0;
    d.tMode = null;
    d.touching = true;
  };

  private onTouchMove = (e: TouchEvent) => {
    const d = this.d;
    if (!d || !d.tStart || !e.touches || e.touches.length !== 1) return;
    const dy = d.tStart.y - e.touches[0].clientY;
    const dx = d.tStart.x - e.touches[0].clientX;
    if (d.tMode === null && (Math.abs(dy) > 6 || Math.abs(dx) > 6)) {
      d.tMode = Math.abs(dx) > Math.abs(dy) ? 'x' : this.controlled(dy) ? 'story' : 'page';
    }
    if (d.tMode === 'story') {
      if (e.cancelable) e.preventDefault();
      d.tDy = dy;
    }
  };

  private onTouchEnd = () => {
    const d = this.d;
    if (!d) return;
    d.touching = false;
    if (d.tMode === 'story' && Math.abs(d.tDy) > 10) d.noClickUntil = performance.now() + 450;
    if (d.tMode === 'story' && !d.anim && Math.abs(d.tDy) > 34) this.step(d.tDy > 0 ? 1 : -1);
    d.tStart = null;
    d.tMode = null;
    if (!d.anim) {
      clearTimeout(d.settleT);
      d.settleT = setTimeout(() => this.settle(), 220);
    }
  };

  private onScroll = () => {
    this.kick(false);
    const d = this.d;
    if (!d || d.anim || this.env.stacked) return;
    clearTimeout(d.settleT);
    d.settleT = setTimeout(() => this.settle(), 160);
  };

  private settle() {
    const d = this.d;
    if (!d || d.anim || d.touching || !d.stops.length) return;
    const y = window.scrollY || 0;
    if (y >= d.restY - 3) {
      this.arrive();
      return;
    }
    const [k, best] = nearestStop(d.stops, y);
    if (best <= STOP_SLOP) this.arrive();
    else this.tweenTo(d.stops[k], settleDuration(best));
  }

  private step(dir: 1 | -1) {
    const d = this.d;
    if (!d || !d.stops.length) return;
    const t = stepTarget(d.stops, window.scrollY || 0, dir);
    if (t >= 0) this.tweenTo(d.stops[t]);
  }

  private tweenTo(y1: number, dur?: number) {
    const d = this.d;
    if (!d) return;
    const y0 = window.scrollY || 0;
    const dist = Math.abs(y1 - y0);
    cancelAnimationFrame(d.tw);
    if (dist < 1) {
      d.anim = false;
      this.arrive();
      return;
    }
    const D = this.env.reduce ? 0 : dur || beatDuration(dist);
    if (!D) {
      window.scrollTo(0, y1);
      d.anim = false;
      this.arrive();
      return;
    }
    d.anim = true;
    const t0 = performance.now();
    const frame = (t: number) => {
      if (!this.d) return;
      const p = clamp((t - t0) / D, 0, 1);
      window.scrollTo(0, y0 + (y1 - y0) * easeQ(p));
      if (p < 1) d.tw = requestAnimationFrame(frame);
      else {
        d.anim = false;
        this.wheel.landed(performance.now());
        this.arrive();
      }
    };
    d.tw = requestAnimationFrame(frame);
  }

  private arrive() {
    const d = this.d;
    if (!d) return;
    const y = window.scrollY || 0;
    const [k, best] = nearestStop(d.stops, y);
    if (k < 0) return;
    if (y >= d.restY - 3) {
      this.enterRest();
      return;
    }
    if (best <= STOP_SLOP) this.enterBeat(k);
  }

  /** Moves to a scene's beat: a tween when paced, the beat's state when stacked. */
  goBeat(scene: string, i: number) {
    const d = this.d;
    if (!d) return;
    if (this.env.stacked) {
      this.stackedBeat(scene, i);
      return;
    }
    const b = d.beats.findIndex((x) => x.scene === scene && x.i === i);
    if (b >= 0) this.tweenTo(d.beats[b].y);
  }

  /** A header, rail or hash request for a scene: Try it on lands after the hero. */
  goScene(scene: SceneKey) {
    if (this.env.stacked) {
      this.scrollToElement(this.d?.secs[scene] ?? null, true);
      return;
    }
    this.goBeat(scene, scene === 'tryon' ? 1 : 0);
  }

  goSceneIndex(i: number) {
    this.goScene(SCENE_ORDER[i]);
  }

  goTop() {
    if (this.env.stacked || !this.d?.stops.length) window.scrollTo({ top: 0, behavior: 'auto' });
    else this.tweenTo(0);
  }

  /** Scrolls to a section after the story (How it works, Ask the store). */
  goSection(id: string) {
    this.scrollToElement(document.getElementById(id), false);
  }

  private scrollToElement(el: HTMLElement | null, exact: boolean) {
    const d = this.d;
    if (!el || !d) return;
    const y = el.getBoundingClientRect().top + (window.scrollY || 0) - (exact ? 0 : d.phone ? 84 : 92);
    if (this.env.stacked || !d.stops.length) window.scrollTo(0, Math.max(0, y));
    else this.tweenTo(Math.max(d.restY, y));
  }

  private onHash = () => {
    this.applyHash(window.location.hash, false);
  };

  /** Deep links: /#store lands on the first beat of that scene, /#try after the hero. */
  applyHash(hash: string, instant: boolean): boolean {
    const d = this.d;
    if (!d) return false;
    let id = decodeURIComponent((hash || '').replace(/^#/, ''));
    if (!id) return false;
    const legacy: Record<string, string> = { how: 'journey', demo: 'try', benefits: 'product' };
    id = legacy[id] ?? id;
    const scene = (Object.entries({ try: 'tryon', store: 'store', ops: 'ops', product: 'product', results: 'results' }) as Array<
      [string, SceneKey]
    >).find(([key]) => key === id)?.[1];
    if (scene) {
      if (this.env.stacked) {
        this.scrollToElement(d.secs[scene] ?? null, true);
        return true;
      }
      const b = d.beats.findIndex((x) => x.scene === scene && x.i === (scene === 'tryon' ? 1 : 0));
      if (b < 0) return false;
      if (instant) {
        window.scrollTo(0, d.beats[b].y);
        this.arrive();
      } else this.tweenTo(d.beats[b].y);
      return true;
    }
    const el = document.getElementById(id);
    if (!el || !d.root.contains(el)) return false;
    if (instant) {
      const y = el.getBoundingClientRect().top + (window.scrollY || 0) - (d.phone ? 84 : 92);
      window.scrollTo(0, Math.max(0, y));
      this.arrive();
    } else this.goSection(id);
    return true;
  }

  /* ---------------------------------------------------------------- beats: each plays in time once you land on it */
  private later(fn: () => void, ms: number) {
    this.beatTimers.later(fn, ms);
  }

  private every(fn: () => void, ms: number) {
    this.beatTimers.every(fn, ms);
  }

  private clearBeat() {
    this.beatTimers.clear();
  }

  private enterRest() {
    const d = this.d;
    if (!d) return;
    if (d.beat === d.stops.length - 1) return;
    d.beat = d.stops.length - 1;
    this.clearBeat();
  }

  private enterBeat(k: number, animate = true) {
    const d = this.d;
    if (!d || k === d.beat) return;
    const prev = d.beat;
    const b = d.beats[k];
    if (!b) return;
    d.beat = k;
    const forward = animate && prev >= 0 && k > prev;
    this.clearBeat();
    if (b.scene === 'tryon') this.beatTryon(b.i, forward);
    else if (b.scene === 'store') this.beatStore(b.i, forward);
    else if (b.scene === 'ops') this.beatOps(b.i, forward);
    else if (b.scene === 'product') this.beatProduct(b.i);
    else if (b.scene === 'results') this.beatResults(b.i, forward);
  }

  /** Stacked mode: a click on a list item, tab or card changes that scene without scrolling. */
  private stackedBeat(scene: string, i: number) {
    if (scene === 'ops') this.beatOps(i, false);
    else if (scene === 'product') this.beatProduct(i);
    else if (scene === 'results') this.beatResults(i, false);
    else if (scene === 'store') this.beatStore(i, false);
  }

  /** Reduced motion or a short screen: every scene shows its final beat. */
  private showEndStates() {
    this.setLook(TRY_END[3][0], TRY_END[3][1]);
    this.setCap(4);
    this.setState({ ...STORE_STATE[3] });
    this.setState({ ob: 3, os: OPS2[3].pos.length - 1, opsN: this.state.opsN + 1 });
    this.beatProduct(4);
    const d = this.d;
    if (d) {
      d.cpos = 7;
      d.upto = 7;
      this.setGallery(7, 7);
    }
  }

  private setCap(n: number) {
    const d = this.d;
    if (!d) return;
    d.capWant = n;
    this.apply();
  }

  private setLook(look: number, lock: boolean) {
    const s = this.state;
    const up: Partial<StoryState> = {};
    if (look !== s.look) Object.assign(up, { prev: s.look, look, swaps: s.swaps + 1 });
    if (lock !== s.lock) Object.assign(up, { lock, peekN: s.peekN + 1, peekDir: lock ? 'down' : 'up' });
    if (Object.keys(up).length) this.setState(up);
  }

  private beatTryon(i: number, forward: boolean) {
    const d = this.d;
    if (!d) return;
    const s = this.state;
    this.ptrHide();
    if (i >= 1 && !d.chat && !d.phone) {
      d.chat = true;
      this.later(() => this.startChat(), 450);
    }
    if (i === 0) {
      this.setCap(0);
      if (!s.touched) this.setLook(0, false);
      return;
    }
    this.setCap(i);
    if (s.touched) {
      if (i === 3) this.later(() => this.setCap(4), 2200);
      return;
    }
    if (!forward || this.env.reduce || s.still) {
      this.setLook(TRY_END[i][0], TRY_END[i][1]);
      if (i === 3) this.setCap(4);
      return;
    }
    this.setLook(TRY_END[i - 1][0], TRY_END[i - 1][1]);
    this.later(() => this.pointerTo(i - 1), 140);
    this.later(() => {
      this.tapPointer();
      this.setLook(TRY_END[i][0], TRY_END[i][1]);
    }, 1080);
    this.later(() => this.ptrHide(), 2300);
    if (i === 3) this.later(() => this.setCap(4), 2700);
  }

  private beatStore(i: number, forward: boolean) {
    const d = this.d;
    if (!d) return;
    const s = this.state;
    this.sPtrHide();
    const from = forward && d.lastStore === i - 1;
    d.lastStore = i;
    if (i === 0) {
      this.setState(STORE_STATE[0]);
      if (!this.env.reduce && !s.still) this.later(() => this.sPointerTo('tile-abayas'), 900);
      return;
    }
    if (!from || this.env.reduce || s.still) {
      this.setState(STORE_STATE[i]);
      return;
    }
    if (i === 1) {
      this.sPointerTo('tile-abayas');
      this.later(() => this.sTap(), 650);
      this.later(() => this.setState({ sv: 1 }), 800);
      this.later(() => this.sPtrHide(), 1300);
      this.later(() => this.setState({ sAnn: 1 }), 1500);
      this.later(() => this.setState({ sChat: 1 }), 2300);
      this.later(() => this.setState({ sChat: 2, sAnn: 5 }), 3200);
    } else if (i === 2) {
      this.setState({ sAnn: 0, sChat: 0 });
      this.later(() => this.sPointerTo('card-riyadh'), 120);
      this.later(() => this.sTap(), 900);
      this.later(() => this.setState({ sv: 2, sScrollI: 0 }), 1050);
      this.later(() => this.sPtrHide(), 1250);
      this.later(() => this.setState({ sScrollI: 1 }), 1750);
      this.later(() => this.sPointerTo('tryon-btn'), 2750);
      this.later(() => this.sTap(), 3450);
      this.later(() => this.setState({ sPanel: 1 }), 3550);
      this.later(() => this.setState({ sScrollI: 2 }), 3800);
      this.later(() => this.sPtrHide(), 4000);
      this.later(() => this.setState({ sAnn: 2 }), 4700);
    } else if (i === 3) {
      this.later(() => this.setState({ sPanel: 2 }), 250);
      this.later(() => this.sPointerTo('gen-btn'), 1150);
      this.later(() => this.setState({ sCall: true }), 1900);
      this.later(() => this.sPtrHide(), 2600);
    }
  }

  private sPointerTo(sel: string) {
    const d = this.d;
    if (!d || this.env.reduce) return;
    const vp = d.k.sview;
    if (!vp) return;
    const el = vp.querySelector<HTMLElement>(`[data-sp="${sel}"]`);
    if (!el) return;
    const pos = this.offsetIn(el, vp);
    if (!pos) return;
    const x = pos[0] + el.offsetWidth / 2;
    let y = pos[1] + el.offsetHeight / 2;
    if (sel === 'tile-abayas') y = pos[1] + el.offsetWidth * 0.45;
    if (sel === 'card-riyadh') y = pos[1] + (d.phone ? 90 : 120);
    if (el.closest('[data-sscroll]')) y -= STORE_SCROLL[d.phone ? 'phone' : 'desk'][this.state.sScrollI || 0];
    this.st('sptr', 'transform', `translate3d(${r1(x)}px, ${r1(y)}px, 0)`);
    this.st('sptr', 'opacity', '1');
  }

  private sPtrHide() {
    this.st('sptr', 'opacity', '0');
  }

  private sTap() {
    const d = this.d;
    if (!d || this.env.reduce) return;
    d.tapN += 1;
    this.st('sptrRing', 'animation-name', d.tapN % 2 ? 'gcs-tap-a' : 'gcs-tap-b');
    this.st('sptrIn', 'transform', 'scale(0.84)');
    clearTimeout(this.sTapTimer);
    this.sTapTimer = setTimeout(() => this.st('sptrIn', 'transform', 'scale(1)'), 180);
  }

  private beatOps(i: number, forward: boolean) {
    const s = this.state;
    const n = OPS2[i].pos.length;
    if (!forward || this.env.reduce || s.still) {
      this.setState({ ob: i, os: n - 1, opsN: s.opsN + 1 });
      return;
    }
    this.setState({ ob: i, os: 0, opsN: s.opsN + 1 });
    this.every(() => {
      const t = this.state;
      if (t.os + 1 < n) this.setState({ os: t.os + 1 });
    }, OPS_MS);
  }

  stepsOf(i: number, s: StoryState = this.state) {
    return i === 3 && s.wfScen >= 0 ? OPS[s.wfScen].pos.length : STEPS[i];
  }

  private beatProduct(i: number) {
    const s = this.state;
    this.setState({
      prevTab: s.tab === i ? -1 : s.tab,
      prevPs: s.ps,
      tab: i,
      ps: s.still ? STEPS[i] - 1 : 0,
      tabN: s.tabN + 1,
      tabAuto: true,
      casePlay: false,
      wfScen: -1,
    });
    if (s.still) return;
    const d = this.d;
    if (d) d.hold = 0;
    this.every(() => {
      const t = this.state;
      const dd = this.d;
      if (t.casePlay || !dd) return;
      const n = this.stepsOf(t.tab);
      if (t.ps + 1 < n) this.setState({ ps: t.ps + 1 });
      else if (++dd.hold > 3) {
        dd.hold = 0;
        this.setState({ ps: 0, tabN: t.tabN + 1, prevTab: -1 });
      }
    }, STEP_MS);
  }

  private beatResults(i: number, forward: boolean) {
    const a = 2 * i;
    const b = a + 1;
    if (!forward || this.env.reduce || this.state.still) {
      this.setGallery(b, b);
      return;
    }
    this.setGallery(a, a - 1);
    this.later(() => this.setGallery(a, a), 620);
    this.later(() => this.setGallery(b, a), 1750);
    this.later(() => this.setGallery(b, b), 2400);
  }

  private setGallery(cpos: number, upto: number) {
    const d = this.d;
    if (!d) return;
    d.cpos = cpos;
    d.upto = upto;
    const L = d.L;
    const mirror = this.env.rtl ? -1 : 1;
    for (let i = 0; i < 8; i++) {
      const dd = i - cpos;
      const ad = Math.abs(dd);
      const sg = (dd < 0 ? -1 : 1) * mirror;
      const x = sg * lerpStops(L.X, ad) * d.spread;
      const sc = lerpStops(L.S, ad) * d.fitC;
      const rot = this.env.reduce ? 0 : clamp(dd, -1.4, 1.4) * -8 * mirror;
      this.st(`card${i}`, 'transform', `translate3d(${r1(x)}px, 0, 0) rotateY(${r2(rot)}deg) scale(${r4(sc)})`);
      this.st(`card${i}`, 'opacity', r3(lerpStops(L.O, ad)));
      this.st(`card${i}`, 'z-index', String(30 - Math.round(ad * 4)));
      this.st(`card${i}`, 'visibility', ad >= 3 ? 'hidden' : 'visible');
    }
    this.st('cfill', 'transform', `scaleX(${r3((cpos + 1) / 8)})`);
    const flips = Array.from({ length: 8 }, (_, i) => (i <= upto ? '1' : '0')).join('');
    if (flips !== d.flips) {
      d.flips = flips;
      this.setCards(flips);
    }
    if (cpos !== this.state.cIdx) this.setState({ cIdx: cpos });
  }

  private setCards(flips: string) {
    const cards = this.state.cards.map((c, i) => {
      const on = flips[i] === '1';
      return c.on === on ? c : { on, n: c.n + 1, dir: on ? ('down' as const) : ('up' as const) };
    });
    this.setState({ cards });
  }

  goCard(i: number) {
    const s = this.state;
    if (i === s.cIdx) {
      this.card(i, !s.cards[i].on);
      return;
    }
    this.goBeat('results', Math.floor(i / 2));
  }

  card(i: number, on: boolean) {
    const cards = this.state.cards.slice();
    const c = cards[i];
    if (c.on === on) return;
    cards[i] = { on, n: c.n + 1, dir: on ? 'down' : 'up' };
    this.setState({ cards });
  }

  private pointerTo(ptr: number) {
    const d = this.d;
    if (!d || this.env.reduce) return;
    const stage = d.k.stage;
    if (!stage) return;
    let el: HTMLElement | null = null;
    if (ptr === 0) el = stage.querySelectorAll<HTMLElement>('[data-ptr="garments"] button')[1] ?? null;
    else if (ptr === 1) el = stage.querySelector<HTMLElement>('[data-ptr="photo"]');
    else el = stage.querySelector<HTMLElement>('[data-ptr="shopper2"]');
    const pos = el ? this.offsetIn(el, stage) : null;
    if (!el || !pos) return;
    let x = pos[0] + el.offsetWidth / 2;
    let y = pos[1] + el.offsetHeight / 2;
    if (ptr === 1) {
      const inset = d.phone ? 58 : 66;
      /* The compare hint sits at the frame's end corner. */
      x = this.env.rtl ? pos[0] + inset : pos[0] + el.offsetWidth - inset;
      y = pos[1] + el.offsetHeight - 24;
    }
    d.ptr = ptr;
    this.st('ptr', 'transform', `translate3d(${r1(x)}px, ${r1(y)}px, 0)`);
    this.st('ptr', 'opacity', '1');
  }

  private ptrHide() {
    const d = this.d;
    if (!d) return;
    d.ptr = -1;
    this.st('ptr', 'opacity', '0');
  }

  private tapPointer() {
    const d = this.d;
    if (!d || this.env.reduce || d.ptr < 0) return;
    d.tapN += 1;
    this.st('ptrRing', 'animation-name', d.tapN % 2 ? 'gcs-tap-a' : 'gcs-tap-b');
    this.st('ptrIn', 'transform', 'scale(0.84)');
    clearTimeout(this.tapTimer);
    this.tapTimer = setTimeout(() => this.st('ptrIn', 'transform', 'scale(1)'), 180);
  }

  /* ---------------------------------------------------------------- try-on stage */
  pickLook(i: number) {
    const s = this.state;
    if (i === s.look) {
      this.setState({ touched: true });
      return;
    }
    this.setState({ prev: s.look, look: i, swaps: s.swaps + 1, touched: true, lock: false });
  }

  pickShopper(k: number) {
    const s = this.state;
    if (LOOK_SHOPPER[s.look] === k) {
      this.setState({ touched: true });
      return;
    }
    this.setState({ prev: s.look, look: SHOPPERS[k][0], swaps: s.swaps + 1, touched: true, lock: false, hover: false });
  }

  private canPeek() {
    return PHOTO[LOOK_SHOPPER[this.state.look]] !== '';
  }

  private setPeek(hover: boolean, lock: boolean) {
    const s = this.state;
    const was = s.hover || s.lock;
    const now = hover || lock;
    this.setState({
      hover,
      lock,
      peekN: now !== was ? s.peekN + 1 : s.peekN,
      peekDir: now !== was ? (now ? 'down' : 'up') : s.peekDir,
      touched: s.touched || lock,
    });
  }

  peekIn = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && this.canPeek()) this.setPeek(true, this.state.lock);
  };

  peekOut = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') this.setPeek(false, this.state.lock);
  };

  peekTap = (e: React.MouseEvent) => {
    const pt = (e.nativeEvent as PointerEvent).pointerType ?? '';
    if (pt === 'mouse' || !this.canPeek()) return;
    this.setPeek(false, !this.state.lock);
  };

  /* ---------------------------------------------------------------- hero chat (scripted demo, never calls an AI) */
  private push(msg: Omit<ChatMsg, 'id'>) {
    this.setState((s) => ({ thread: s.thread.filter((m) => m.kind !== 'typing').concat([{ ...msg, id: s.seq + 1 }]), seq: s.seq + 1 }));
  }

  private finish(msg: Omit<ChatMsg, 'id'>, step: StoryState['step']) {
    this.setState((s) => ({
      thread: s.thread.filter((m) => m.kind !== 'typing').concat([{ ...msg, id: s.seq + 1 }]),
      seq: s.seq + 1,
      busy: false,
      step,
    }));
  }

  resetChat(lang: ChatLang) {
    this.chatTimers.clear();
    this.setState({ lang, thread: [], asked: {}, busy: false, step: 'start' });
  }

  ask(key: ChatKey, auto: boolean) {
    const s = this.state;
    if (s.busy) return;
    if (!auto && !s.chatTouched) this.setState({ chatTouched: true });
    if (key === 'restart') {
      this.resetChat(s.lang);
      return;
    }
    const L = CHAT[s.lang];
    this.setState({ busy: true, asked: { ...s.asked, [key]: true } });
    this.push({ kind: 'user', text: L[key] });
    this.chatTimers.later(() => this.push({ kind: 'typing' }), 380);
    if (key === 'q1') this.chatTimers.later(() => this.finish({ kind: 'ai', text: L.a1 }, 'afterA1'), 1700);
    else if (key === 'guide') this.chatTimers.later(() => this.finish({ kind: 'ai', text: L.guideA }, 'afterGuide'), 1400);
    else {
      this.chatTimers.later(() => this.push({ kind: 'system', text: L.connecting }), 1200);
      this.chatTimers.later(() => this.push({ kind: 'handoff' }), 2100);
      this.chatTimers.later(() => this.push({ kind: 'system', text: L.joined }), 3500);
      this.chatTimers.later(() => this.push({ kind: 'typing' }), 3900);
      this.chatTimers.later(() => this.finish({ kind: 'team', text: L.teamA }, 'done'), 5300);
    }
  }

  setChatLang(lang: ChatLang) {
    if (lang === this.state.lang) return;
    this.setState({ chatTouched: true });
    this.resetChat(lang);
  }

  startChat() {
    const s = this.state;
    if (!s.chatTouched && s.thread.length === 0 && !s.busy) this.ask('q1', true);
  }

  /* ---------------------------------------------------------------- product tabs */
  pickTab(i: number) {
    this.goBeat('product', i);
  }

  pickCase(c: number) {
    const s = this.state;
    this.clearCase();
    this.setState({
      prevTab: s.tab === 3 ? -1 : s.tab,
      prevPs: s.ps,
      tab: 3,
      tabAuto: true,
      tabN: s.tabN + 1,
      ps: s.still ? OPS[c].pos.length - 1 : 0,
      wfScen: c,
      casePlay: true,
    });
    if (s.still) return;
    this.every(() => {
      const t = this.state;
      if (!t.casePlay || t.wfScen < 0) return;
      if (t.ps + 1 >= OPS[t.wfScen].pos.length) return;
      this.setState({ ps: t.ps + 1 });
    }, STEP_MS);
  }

  private clearCase() {
    /* A case replaces the tab's loop: both live on the beat timers. */
    this.clearBeat();
  }
}
