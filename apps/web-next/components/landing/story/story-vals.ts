/* The values each scene view reads, computed from the story state. A port
   of the prototype's renderVals, split by scene so a tick in one scene only
   recomputes that scene, with every colour mapped to a token: the page
   scenes use the theme tokens, the AI operations scene its fixed dark
   palette. */

import type * as React from 'react';
import { trackMarketingEvent } from '@/lib/analytics';
import type { StoryController, StoryState } from './story-controller';
import {
  CHAT,
  DAILY,
  LOOK_NAMES,
  LOOK_SHOPPER,
  N_LOOKS,
  N_PHOTOS,
  N_SHOPPERS,
  NODE_MARK,
  OPS,
  OPS2,
  OPS2_DEF,
  OPS2_EDGE,
  OPS2_KEYS,
  OPS2_TITLE,
  OPS_EDGES,
  OPS_MS,
  OPS_SUB,
  OPS_TITLE,
  PART_DESC,
  PART_NAMES,
  PATHS,
  PHOTO,
  PHOTO_IDX,
  STEP_MS,
  STORE_PATHS,
  STORE_SCROLL,
  STORE_URL,
  type ChatKey,
  type OpsNodeKey,
} from './story-data';
import { STORY_AR, type StoryText } from './story-strings';
import type { StoryLayout, V } from './story-types';

/* Page scenes follow the theme. */
const INK = 'var(--foreground)';
const CREAM = 'var(--background)';
const CARD = 'var(--card)';
const LINE = 'var(--border)';
const SECOND = 'var(--secondary)';
const MUTED = 'var(--muted-foreground)';
const TEXT2 = 'var(--gc-text-2)';
const INACTIVE = 'var(--gc-inactive)';
const LINE_STRONG = 'var(--gc-line-strong)';
const SHADOW = (a: number) => `rgb(32 29 27 / ${a})`;
const mix = (token: string, pct: number) => `color-mix(in srgb, ${token} ${pct}%, transparent)`;

/* The AI operations scene is dark in both themes. */
const D_INK = 'var(--gc-ink)';
const D_CREAM = 'var(--gc-cream)';
const D_INK2 = 'var(--gc-ink-2)';
const dc = (a: number) => mix(D_CREAM, Math.round(a * 1000) / 10);

export type ValsEnv = {
  layout: StoryLayout;
  locale: 'en' | 'ar';
  rtl: boolean;
  controller: StoryController;
  managedSetup: boolean;
};

/** In Arabic, text values set by the logic come through the story table once. */
function translate(v: V, env: ValsEnv, skip: ReadonlySet<string> = new Set()): V {
  if (env.locale !== 'ar') return v;
  const table = STORY_AR as Record<string, string>;
  for (const key of Object.keys(v)) {
    const x = v[key];
    if (typeof x === 'string' && !skip.has(key) && table[x] !== undefined) v[key] = table[x];
  }
  return v;
}

export function storyText(locale: 'en' | 'ar') {
  return (text: StoryText): string => (locale === 'ar' ? STORY_AR[text] : text);
}

/* ---------------------------------------------------------------- try-on stage */
export const TRY_KEYS = ['look', 'prev', 'swaps', 'touched', 'hover', 'lock', 'peekN', 'peekDir', 'still'] as const;

export function tryVals(s: StoryState, env: ValsEnv): V {
  const c = env.controller;
  const v: V = {};
  const sh = LOOK_SHOPPER[s.look];
  const photo = PHOTO[sh];
  const peek = (s.hover || s.lock) && photo !== '';
  for (let i = 0; i < N_LOOKS; i++) {
    const active = i === s.look;
    const prev = i === s.prev;
    v[`l${i}Z`] = active ? 3 : prev ? 2 : 1;
    v[`l${i}Clip`] = active || prev ? '0%' : '100%';
    v[`l${i}Tr`] = active ? 'clip-path 0.95s cubic-bezier(0.65, 0, 0.35, 1)' : 'none';
    v[`l${i}On`] = active;
    v[`l${i}Border`] = active ? INK : LINE;
    v[`l${i}Bg`] = active ? CARD : mix(CARD, 55);
    v[`l${i}Shadow`] = active ? `0 12px 26px -16px ${SHADOW(0.6)}` : 'none';
    v[`l${i}Invite`] = !s.touched && !s.still && LOOK_SHOPPER[i] === sh && i !== s.look;
    v[`pickL${i}`] = () => c.pickLook(i);
  }
  for (let k = 0; k < N_SHOPPERS; k++) {
    const on = k === sh;
    v[`sh${k}`] = on;
    v[`s${k}On`] = on;
    v[`s${k}Ring`] = on ? `0 0 0 2px ${CARD}, 0 0 0 4px ${INK}` : `0 0 0 1px ${LINE}`;
    v[`s${k}Op`] = on ? 1 : 0.78;
    v[`pickS${k}`] = () => c.pickShopper(k);
  }
  for (let p = 0; p < N_PHOTOS; p++) v[`p${p}Op`] = PHOTO_IDX[sh] === p ? 1 : 0;
  v.lookName = LOOK_NAMES[s.look];
  v.canCompare = photo !== '';
  v.peekClip = peek ? '0%' : '100%';
  v.peekOn = peek;
  v.chipAi = !peek;
  v.chipHer = peek && photo === 'her';
  v.chipHis = peek && photo === 'his';
  v.swapSweep = `gcs-down-${s.swaps % 2 ? 'a' : 'b'}`;
  v.peekSweep = s.peekN === 0 ? 'none' : `gcs-${s.peekDir}-${s.peekN % 2 ? 'a' : 'b'}`;
  v.peekIn = c.peekIn;
  v.peekOut = c.peekOut;
  v.peekTap = c.peekTap;
  v.hintPick = !s.touched;
  v.hintCompare = s.touched && photo !== '';
  v.hintShopper = s.touched && photo === '';
  v.managedSetup = env.managedSetup;
  return translate(v, env);
}

/* ---------------------------------------------------------------- hero chat */
export const CHAT_KEYS = ['lang', 'thread', 'busy', 'step', 'asked', 'still'] as const;

export function chatVals(s: StoryState, env: ValsEnv): V {
  const c = env.controller;
  const L = CHAT[s.lang];
  const v: V = {};
  v.chatDir = L.dir;
  v.chatLang = s.lang;
  v.chatFont = L.font;
  v.chatNotice = L.notice;
  v.chatPowered = L.powered;
  v.chatIntro = L.intro;
  v.chatEmpty = s.thread.length === 0;
  v.isEn = s.lang === 'en';
  v.isAr = s.lang === 'ar';
  v.enBg = v.isEn ? INK : 'transparent';
  v.enFg = v.isEn ? CREAM : INK;
  v.arBg = v.isAr ? INK : 'transparent';
  v.arFg = v.isAr ? CREAM : INK;
  v.setEn = () => c.setChatLang('en');
  v.setAr = () => c.setChatLang('ar');
  v.thread = s.thread.map((m) => ({
    id: m.id,
    text: m.text || '',
    isUser: m.kind === 'user',
    isBot: m.kind === 'ai' || m.kind === 'team',
    isSystem: m.kind === 'system',
    isHandoff: m.kind === 'handoff',
    isTyping: m.kind === 'typing',
    label: m.kind === 'team' ? L.team : m.kind === 'typing' ? L.typing : L.ai,
    bg: m.kind === 'team' ? SECOND : CREAM,
    title: L.inbox,
    who: L.who,
    initial: L.initial,
    needs: L.needs,
    handed: L.handed,
    assigned: L.assigned,
  }));
  const keys: ChatKey[] = s.busy
    ? []
    : s.step === 'start'
      ? ['q1', 'guide', 'person']
      : s.step === 'afterA1'
        ? s.asked.guide
          ? ['q2']
          : ['q2', 'guide']
        : s.step === 'afterGuide'
          ? s.asked.q1
            ? ['person']
            : ['q1', 'person']
          : ['restart'];
  v.chips = keys.map((k, i) => {
    const lead = i === 0 && k !== 'restart';
    return { label: L.chip[k], go: () => c.ask(k, false), bg: lead ? INK : CREAM, fg: lead ? CREAM : INK, border: lead ? INK : LINE };
  });
  /* The chat has its own language, so none of this goes through the page table. */
  return v;
}

/* ---------------------------------------------------------------- live store */
export const STORE_KEYS = ['sv', 'sPanel', 'sScrollI', 'sAnn', 'sChat', 'sCall', 'still'] as const;

export function storeVals(s: StoryState, env: ValsEnv): V {
  const v: V = {};
  const sv = s.sv || 0;
  const ann = s.sAnn || 0;
  const key = env.layout;
  for (let i = 0; i < 3; i++) v[`sv${i}Op`] = i === sv ? 1 : 0;
  v.sScrollY = `translate3d(0, ${-STORE_SCROLL[key][s.sScrollI || 0]}px, 0)`;
  v.sPath = STORE_PATHS[sv];
  v.sHref = STORE_URL + STORE_PATHS[sv];
  v.sPanelOn = (s.sPanel || 0) > 0;
  v.sUp = s.sPanel === 1;
  v.sReady = s.sPanel === 2;
  [1, 2, 4].forEach((bit, j) => {
    const on = (ann & bit) !== 0;
    v[`sA${j + 1}`] = on ? 1 : 0;
    v[`sA${j + 1}S`] = on ? 1 : 1.04;
  });
  v.sChatOpen = (s.sChat || 0) > 0;
  v.sChatQ = (s.sChat || 0) >= 1;
  v.sChatA = (s.sChat || 0) >= 2;
  v.sChatHint = !v.sChatOpen && sv === 0;
  v.sCallOp = s.sCall ? 1 : 0;
  v.sCallY = s.sCall ? '0px' : '10px';
  v.sRing = s.sCall && !s.still ? 'gcs-ring 1.9s ease-out infinite' : 'none';
  const bar = sv === 2 && s.sScrollI === 1;
  v.sBarOp = bar ? 1 : 0;
  v.sBarY = bar ? '0px' : '16px';
  /* The store window shows the real store in English in both languages. */
  return v;
}

/* ---------------------------------------------------------------- AI operations */
export const OPS_KEYS = ['ob', 'os', 'opsN', 'still'] as const;

export function opsVals(s: StoryState, env: ValsEnv): V {
  const c = env.controller;
  const v: V = {};
  const B = OPS2[s.ob];
  const n = B.pos.length;
  const k = Math.max(0, Math.min(s.os, n - 1));
  const pos = B.pos[k];
  const prevPos = k > 0 ? B.pos[k - 1] : -1;
  const alt = (s.opsN + k) % 2 ? 'a' : 'b';
  const subs: Partial<Record<OpsNodeKey, string>> = {};
  if (B.extra && k >= 1) Object.assign(subs, B.extra);
  for (let j = 0; j <= k; j++) Object.assign(subs, B.subs[j]);
  OPS2_KEYS.forEach((key) => {
    const idx = B.path.indexOf(key);
    const on = idx >= 0;
    const active = on && idx === pos;
    const done = on && idx < pos;
    const P = `on${key}`;
    v[`${P}Bg`] = active ? D_CREAM : done ? dc(0.1) : dc(0.035);
    v[`${P}Fg`] = active ? D_INK : D_CREAM;
    v[`${P}Line`] = active ? D_CREAM : done ? dc(0.5) : dc(0.16);
    v[`${P}Op`] = on ? 1 : key === 'Ai' && B.extra && k >= 1 ? 0.72 : 0.36;
    v[`${P}Sh`] = active ? `0 0 0 5px ${dc(0.1)}, 0 20px 46px -14px ${dc(0.55)}` : 'none';
    v[`${P}S`] = active ? 1.05 : 1;
    v[`${P}SubFg`] = active ? D_INK2 : done ? dc(0.76) : dc(0.6);
    v[`${P}Sub`] = subs[key] || OPS2_DEF[key];
  });
  v.onAiRing = B.path.indexOf('Ai') === pos && !s.still;
  OPS2_EDGE.forEach((e) => {
    const ia = B.path.indexOf(e[0]);
    const ib = B.path.indexOf(e[1]);
    const used = ia >= 0 && ib === ia + 1;
    const trav = used && ib <= pos;
    const arriving = used && ib === pos && pos !== prevPos;
    const E = `oe${e[0]}${e[1]}`;
    v[`${E}Base`] = trav ? D_CREAM : dc(0.22);
    v[`${E}Dash`] = trav ? 'none' : '2 5';
    v[`${E}Op`] = used ? 1 : 0.45;
    v[`${E}Flow`] = arriving && !s.still ? `gcs-oflow-${alt}` : 'none';
  });
  const cnt = B.counts[k];
  for (let i = 0; i < 4; i++) {
    v[`oc${i}`] = cnt[i];
    v[`oc${i}Anim`] = s.still ? 'none' : `gcs-pop-${cnt[i] % 2 ? 'a' : 'b'}`;
  }
  v.opsAnim = `gcs-prog-${s.opsN % 2 ? 'a' : 'b'}`;
  v.opsDur = `${((n * OPS_MS) / 1000 + 0.4).toFixed(2)}s`;
  for (let i = 0; i < 4; i++) {
    const on = i === s.ob;
    v[`ob${i}On`] = on;
    v[`ob${i}Bg`] = on ? dc(0.07) : 'transparent';
    v[`ob${i}Line`] = on ? dc(0.22) : 'transparent';
    v[`ob${i}Num`] = on ? D_CREAM : dc(0.52);
    v[`ob${i}Title`] = on ? D_CREAM : dc(0.66);
    v[`ob${i}Sub`] = on ? dc(0.76) : dc(0.56);
    v[`goOps${i}`] = () => c.goBeat('ops', i);
    v[`os${i}S`] = i < s.ob || (on && s.still) ? 1 : 0;
    v[`os${i}Anim`] = on && !s.still ? v.opsAnim : 'none';
  }
  v.obNum = `0${s.ob + 1}`;
  v.obTitle = B.title;
  v.obDesc = B.desc;
  for (let j = 0; j < 5; j++) {
    const key = B.path[j];
    const show = key !== undefined;
    const active = show && j === pos;
    const done = show && j < pos;
    const P = `opS${j}`;
    v[`${P}Show`] = show;
    v[`${P}Title`] = show ? OPS2_TITLE[key] : '';
    v[`${P}Sub`] = show ? subs[key] || OPS2_DEF[key] : '';
    v[`${P}Bg`] = active ? D_CREAM : done ? dc(0.1) : dc(0.035);
    v[`${P}Fg`] = active ? D_INK : D_CREAM;
    v[`${P}Line`] = active ? D_CREAM : done ? dc(0.45) : dc(0.14);
    v[`${P}Sh`] = active ? `0 16px 34px -14px ${dc(0.5)}` : 'none';
    v[`${P}SubFg`] = active ? D_INK2 : dc(0.64);
    const mk = show ? NODE_MARK[key] : 'i-chat';
    const isLogo = mk.startsWith('l-');
    v[`${P}Ic`] = `#gc-${mk}`;
    v[`${P}IcFill`] = isLogo ? 'currentColor' : 'none';
    v[`${P}IcStroke`] = isLogo ? 'none' : 'currentColor';
    if (j < 4) {
      const kShow = j + 1 < B.path.length;
      const K = `opK${j}`;
      v[`${K}Show`] = kShow;
      v[`${K}Base`] = kShow && j + 1 <= pos ? D_CREAM : dc(0.16);
      v[`${K}Flow`] = kShow && j + 1 === pos && pos !== prevPos && !s.still ? `gcs-grow-${alt}` : 'none';
    }
  }
  v.managedSetup = env.managedSetup;
  return translate(v, env);
}

/* ---------------------------------------------------------------- the product */
export const PRODUCT_KEYS = ['tab', 'ps', 'prevTab', 'prevPs', 'tabN', 'tabAuto', 'casePlay', 'wfScen', 'still'] as const;

export function productVals(s: StoryState, env: ValsEnv): V {
  const c = env.controller;
  const v: V = {};
  const flipX = env.rtl ? -1 : 1;
  for (let i = 0; i < 5; i++) {
    const on = i === s.tab;
    v[`tab${i}On`] = on;
    v[`tab${i}Bg`] = on ? INK : 'transparent';
    v[`tab${i}Fg`] = on ? CREAM : TEXT2;
    v[`tab${i}Sub`] = on ? INACTIVE : MUTED;
    v[`tab${i}Bar`] = on && s.tabAuto && !s.still;
    v[`pane${i}Op`] = on ? 1 : 0;
    v[`pane${i}Y`] = on ? '0px' : '14px';
    v[`pane${i}Hide`] = !on;
    v[`pickTab${i}`] = () => {
      /* Tab clicks are the one engagement the story reports. */
      trackMarketingEvent({ name: 'storefront.product_tab_engaged', properties: { tab: PART_NAMES[i].toLowerCase() } });
      c.pickTab(i);
    };
  }
  v.progAnim = `gcs-prog-${s.tabN % 2 ? 'a' : 'b'}`;
  const P = PATHS[env.layout];
  const alt = s.tabN % 2 ? 'a' : 'b';
  const stepsOf = (i: number) => c.stepsOf(i, s);
  const stepOf = (i: number) => (s.still ? stepsOf(i) - 1 : i === s.tab ? s.ps : i === s.prevTab ? s.prevPs : 0);
  const place = (key: 'sfP' | 'cvP' | 'cuP' | 'rpP', q: number) => {
    const p = P[key][Math.min(q, P[key].length - 1)];
    v[`${key}X`] = `${p[0] * flipX}px`;
    v[`${key}Y`] = `${p[1]}px`;
    v[`${key}Op`] = s.still ? 0 : p[2];
    v[`${key}Tap`] = p[3] && !s.still ? `gcs-tap-${alt}` : 'none';
  };
  v.progDur = `${(stepsOf(s.tab) * STEP_MS) / 1000}s`;
  for (let i = 0; i < 5; i++) v[`pane${i}Pe`] = i === s.tab ? 'auto' : 'none';
  {
    /* storefront */
    const q = stepOf(0);
    v.sfEmbedOp = q >= 2 ? 1 : 0;
    v.sfClip = q >= 2 ? 'inset(0px 0px 0px 0px round 14px)' : P.sfClosed;
    v.sfEmbedTr =
      q >= 2
        ? 'clip-path 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.3s, opacity 0.2s ease 0.3s'
        : 'clip-path 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease';
    v.sfTryBg = q === 2 ? SECOND : 'transparent';
    v.sfTryS = q === 2 ? 0.97 : 1;
    v.sfT1 = q <= 3;
    v.sfT2 = q === 4 || q === 5;
    v.sfT3 = q === 6 || q === 7;
    v.sfT4 = q >= 8;
    v.sfBoxLine = q >= 4 ? 'transparent' : INACTIVE;
    v.sfPhotoOp = q >= 4 ? 1 : 0;
    v.sfPhotoS = q >= 4 ? 1 : 0.94;
    v.sfScanAnim = q === 6 || q === 7 ? 'gcs-scan-once' : 'none';
    v.sfLoad = q === 6 || q === 7;
    v.sfL1 = q === 6;
    v.sfL2 = q === 7;
    v.sfResClip = q >= 8 ? '0%' : '100%';
    v.sfResTr = q >= 8 ? 'clip-path 0.95s cubic-bezier(0.65, 0, 0.35, 1)' : 'none';
    v.sfSweep = q === 8 && !s.still ? `gcs-down-${alt}` : 'none';
    v.sfPriv = q <= 5;
    v.sfGen = q === 6 || q === 7;
    v.sfNote = q >= 8;
    v.sfProg = q >= 7 ? '92%' : q >= 6 ? '46%' : '0%';
    v.sfBtnGen = q < 8;
    v.sfBtnCart = q >= 8;
    v.sfGenOp = q === 4 || q === 5 ? 1 : 0.35;
    v.sfGenS = q === 6 ? 0.97 : 1;
    v.sfAdding = q === 10;
    v.sfAddIdle = q !== 10;
    v.sfCartBtnS = q === 10 ? 0.97 : 1;
    v.sfCart = q >= 11 ? 1 : 0;
    v.sfCartS = q >= 11 ? 1 : 0.4;
    place('sfP', q);
  }
  {
    /* conversation */
    const q = stepOf(1);
    v.cv1 = q >= 1;
    v.cvT1 = q === 2;
    v.cv2 = q >= 3;
    v.cvRate = q < 6;
    v.cvThanks = q >= 6;
    v.cvUpBg = q === 4 ? SECOND : q === 5 ? LINE : 'transparent';
    v.cv3 = q >= 7;
    v.cvBanner = q >= 8;
    v.cvB1 = q < 12;
    v.cvB2 = q >= 12;
    v.cvContact = q >= 8;
    v.cvForm = q < 12;
    v.cvDone = q >= 12;
    v.cvPh = q < 9;
    v.cvTyped = q >= 9;
    v.cvType = q >= 9 && !s.still ? `gcs-type-${alt}` : 'none';
    v.cvInLine = q >= 9 && q < 12 ? INK : LINE;
    v.cvSendS = q === 11 ? 0.94 : 1;
    v.cvT2 = q === 12;
    v.cv4 = q >= 13;
    place('cvP', q);
  }
  {
    /* customer */
    const q = stepOf(2);
    const open = q >= 3;
    v.cuNew = q >= 1;
    v.cuUnread = !open;
    v.cuSLine = open ? INK : 'transparent';
    v.cuSBg = open ? CREAM : 'transparent';
    v.cuALine = open ? 'transparent' : INK;
    v.cuABg = open ? 'transparent' : CREAM;
    v.cuThA = !open;
    v.cuThS = open;
    v.cuDetailX = open ? '0px' : `${330 * flipX}px`;
    v.cuDetailTr = open
      ? 'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.3s'
      : 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)';
    v.cuHand = true;
    v.cuS1 = true;
    v.cuS2 = false;
    v.cuTake = true;
    v.cuRet = false;
    v.cuNoOne = true;
    v.cuOmar = false;
    v.cuSelBg = 'transparent';
    place('cuP', q);
  }
  {
    /* workflow: how work moves between the AI and your team */
    const q = stepOf(3);
    const auto = s.wfScen < 0;
    const first = OPS[0].pos.length;
    const sc = auto ? (q < first ? 0 : 1) : s.wfScen;
    const O = OPS[sc];
    const st = auto && sc === 1 ? q - first : q;
    const k = Math.max(0, Math.min(st, O.pos.length - 1));
    const pos = O.pos[k];
    const prevPos = k > 0 ? O.pos[k - 1] : -1;
    const alt2 = (s.tabN + q) % 2 ? 'a' : 'b';
    const subs: Record<string, string> = {};
    for (let j = 0; j <= k; j++) Object.assign(subs, O.subs[j]);
    for (let n = 1; n <= 7; n++) {
      const idx = O.path.indexOf(n);
      const on = idx >= 0;
      const active = on && idx === pos;
      const done = on && idx < pos;
      v[`wfN${n}Bg`] = active ? INK : CARD;
      v[`wfN${n}Fg`] = active ? CREAM : on ? INK : TEXT2;
      v[`wfN${n}Line`] = active || done ? INK : LINE;
      v[`wfN${n}Op`] = on ? 1 : 0.4;
      v[`wfN${n}Sh`] = active ? `0 16px 30px -16px ${SHADOW(0.65)}` : 'none';
      v[`wfN${n}S`] = active ? 1.04 : 1;
      v[`wfN${n}Done`] = done;
      v[`wfN${n}Sub`] = subs[n] || OPS_SUB[n];
    }
    OPS_EDGES.forEach((e) => {
      const ia = O.path.indexOf(+e[0]);
      const ib = O.path.indexOf(+e[1]);
      const used = ia >= 0 && ib === ia + 1;
      const traversed = used && ib <= pos;
      const arriving = used && ib === pos && pos !== prevPos;
      v[`wfE${e}Base`] = traversed ? INK : LINE_STRONG;
      v[`wfE${e}Dash`] = traversed ? 'none' : '3 5';
      v[`wfE${e}Op`] = used ? 1 : 0.45;
      v[`wfE${e}Flow`] = arriving && !s.still ? `gcs-flow-${alt2}` : 'none';
    });
    for (let j = 0; j < 6; j++) {
      const n = O.path[j];
      const show = n !== undefined;
      const active = show && j === pos;
      const done = show && j < pos;
      v[`wfP${j}Show`] = show;
      v[`wfP${j}Title`] = show ? OPS_TITLE[n] : '';
      v[`wfP${j}Sub`] = show ? subs[n] || OPS_SUB[n] : '';
      v[`wfP${j}Bg`] = active ? INK : CARD;
      v[`wfP${j}Fg`] = active ? CREAM : INK;
      v[`wfP${j}Line`] = active || done ? INK : LINE;
      v[`wfP${j}Sh`] = active ? `0 12px 24px -14px ${SHADOW(0.6)}` : 'none';
      const kShow = j + 1 < O.path.length;
      v[`wfK${j}Show`] = kShow;
      v[`wfK${j}Base`] = kShow && j + 1 <= pos ? INK : LINE_STRONG;
      v[`wfK${j}Flow`] = kShow && j + 1 === pos && pos !== prevPos && !s.still ? `gcs-grow-${alt2}` : 'none';
    }
    v.wfLine = O.lines[k];
    v.wfLA = (s.tabN + q) % 2 === 0;
    v.wfLB = !v.wfLA;
    v.wfStep = `${k + 1} of ${O.pos.length}`;
    for (let n = 0; n < OPS.length; n++) {
      const on = n === sc;
      v[`wfC${n}On`] = on;
      v[`wfC${n}Bg`] = on ? INK : 'transparent';
      v[`wfC${n}Fg`] = on ? CREAM : INK;
      v[`pickCase${n}`] = () => c.pickCase(n);
    }
  }
  {
    /* report */
    const q = stepOf(4);
    const f = [0, 0.35, 0.7, 1][Math.min(q, 3)];
    v.rpConv = Math.round(42 * f);
    v.rpAi = Math.round(29 * f);
    v.rpTeam = Math.round(13 * f);
    v.rpOpen = Math.round(3 * f);
    v.rpReply = `${Math.round(38 * f)}s`;
    v.rpSat = `${Math.round(91 * f)}%`;
    v.rpGen = Math.round(64 * f);
    v.rpRate = `${Math.round(95 * f)}%`;
    v.rpSplit = q >= 3 ? '69%' : '0%';
    for (let i = 0; i < DAILY.length; i++) v[`rpBar${i}`] = q >= 4 ? `${Math.round((DAILY[i] / 12) * 100)}%` : '4%';
    v.rpTip = q >= 6 && q <= 8;
    v.rpHi = q >= 6 && q <= 8 ? INK : MUTED;
    place('rpP', q);
  }
  v.partNum = `0${s.tab + 1}`;
  v.partName = PART_NAMES[s.tab];
  v.partDesc = PART_DESC[s.tab];
  for (let i = 0; i < 5; i++) {
    v[`seg${i}S`] = i < s.tab || (i === s.tab && s.still) ? 1 : 0;
    v[`seg${i}Anim`] = i === s.tab && !s.still ? v.progAnim : 'none';
  }
  return translate(v, env);
}

/* ---------------------------------------------------------------- results */
export const RESULTS_KEYS = ['cards', 'cIdx', 'still'] as const;

export function resultsVals(s: StoryState, env: ValsEnv): V {
  const c = env.controller;
  const v: V = {};
  for (let i = 0; i < 8; i++) {
    const card = s.cards[i];
    v[`c${i}On`] = card.on;
    v[`c${i}Clip`] = card.on ? '0%' : '100%';
    v[`c${i}Sweep`] = card.n === 0 || s.still ? 'none' : `gcs-${card.dir}-${card.n % 2 ? 'a' : 'b'}`;
    v[`c${i}A`] = !card.on;
    v[`c${i}B`] = card.on;
    v[`c${i}AOp`] = card.on ? 0 : 1;
    v[`c${i}BOp`] = card.on ? 1 : 0;
    v[`cIn${i}`] = (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') c.card(i, true);
    };
    v[`cOut${i}`] = (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') c.card(i, false);
    };
    v[`cGo${i}`] = () => c.goCard(i);
  }
  v.resNum = String(s.cIdx + 1).padStart(2, '0');
  return translate(v, env);
}
