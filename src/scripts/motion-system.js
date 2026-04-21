/* ================================================================
   GRINDCTRL Motion System
   Lenis smooth scroll + GSAP ScrollTrigger + micro-interactions.
   Self-initializes on import. Respects prefers-reduced-motion.
   ================================================================ */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

let _lenis = null;
let _inited = false;
let _revealObs = null;
let _staggerObs = null;
const _matchReduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const EASE = {
  crisp: 'power3.out',
  snappy: 'power2.out',
  smooth: 'power2.inOut',
  snap: 'power2.out',
};

/* ── Lenis + GSAP Ticker ── */

function _initLenis() {
  if (_matchReduce()) return;
  try {
    _lenis = new Lenis({ lerp: 0.1, smoothWheel: true, smoothTouch: false });
    _lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => { _lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  } catch (_) { _lenis = null; }
}

/* ── Reveal-on-enter (.reveal) ── */

function _initReveals() {
  if (_matchReduce() || typeof ScrollTrigger === 'undefined') return;
  const els = document.querySelectorAll('.reveal:not(.visible):not([data-stagger] > .reveal)');
  if (!els.length) return;
  els.forEach((el) => {
    gsap.set(el, { opacity: 0, y: 32 });
    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter: () => {
        const delay = el.classList.contains('reveal-delay-1') ? 0.1
          : el.classList.contains('reveal-delay-2') ? 0.2 : 0;
        gsap.to(el, {
          opacity: 1, y: 0,
          duration: 0.75, ease: EASE.crisp, delay,
          clearProps: 'opacity,transform',
          onComplete: () => el.classList.add('visible'),
        });
      },
    });
  });
}

/* ── Staggered children reveal ([data-stagger]) ── */

function _initStaggers() {
  if (_matchReduce() || typeof ScrollTrigger === 'undefined') return;
  const parents = document.querySelectorAll('[data-stagger]');
  parents.forEach((parent) => {
    const kids = parent.querySelectorAll(':scope > .reveal');
    if (!kids.length) return;
    gsap.set(kids, { opacity: 0, y: 24 });
    ScrollTrigger.create({
      trigger: parent,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        gsap.to(kids, {
          opacity: 1, y: 0,
          duration: 0.6, ease: EASE.crisp,
          stagger: 0.1,
          clearProps: 'opacity,transform',
          onComplete: () => kids.forEach((k) => k.classList.add('visible')),
        });
      },
    });
  });
}

/* ── Gentle panel lift on hover ── */

function _initHoverLift() {
  if (_matchReduce()) return;
  document.querySelectorAll('[data-hover-lift]').forEach((el) => {
    const lift = parseFloat(el.dataset.hoverLift) || 2;
    const dur = parseFloat(el.dataset.hoverDur) || 0.25;
    el.addEventListener('mouseenter', () => {
      gsap.to(el, { y: -lift, duration: dur, ease: EASE.snappy, overwrite: 'auto' });
    });
    el.addEventListener('mouseleave', () => {
      gsap.to(el, { y: 0, duration: dur, ease: EASE.snappy, overwrite: 'auto' });
    });
    el.addEventListener('focusin', () => {
      gsap.to(el, { y: -(lift * 0.5), duration: dur, ease: EASE.snappy, overwrite: 'auto' });
    });
    el.addEventListener('focusout', () => {
      gsap.to(el, { y: 0, duration: dur, ease: EASE.snappy, overwrite: 'auto' });
    });
  });
}

/* ── Toolbar / button micro-interactions ── */

function _initMicroTap() {
  if (_matchReduce()) return;
  const targets = document.querySelectorAll(
    '.gc-btn, .ui-btn, .ed-btn, .ed-drop-btn, .theme-btn, .gc-chip, .gc-app-topbar-link, .nav-link, .drawer-link, .drawer-link-highlight, .gc-app-sidebar-item, .gc-segmented-btn, .gc-auth-cta, .gc-auth-link'
  );
  targets.forEach((el) => {
    el.addEventListener('pointerdown', () => {
        gsap.to(el, { scale: 0.98, duration: 0.08, ease: 'power1.in', overwrite: 'auto' });
    });
    const up = () => {
      gsap.to(el, { scale: 1, duration: 0.2, ease: EASE.snap, overwrite: 'auto' });
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointerleave', up);
  });
}

/* ── Tab underline / active-pill transitions ── */

function _initTabTransitions() {
  if (_matchReduce()) return;
  document.querySelectorAll('[data-motion-tab]').forEach((group) => {
    const indicator = group.querySelector('[data-motion-indicator]');
    if (!indicator) return;
    group.querySelectorAll('[data-motion-tab-active]').forEach((tab) => {
      tab.addEventListener('click', () => {
        const r = tab.getBoundingClientRect();
        const g = group.getBoundingClientRect();
        gsap.to(indicator, {
          x: r.left - g.left, width: r.width,
          duration: 0.3, ease: EASE.crisp,
        });
      });
    });
  });
}

/* ── Subtle input focus motion ── */

function _initInputFocus() {
  if (_matchReduce()) return;
  document.querySelectorAll('.gc-input, .gc-textarea, .gc-app-form-input, .gc-app-form-select, .gc-app-form-textarea, .gc-app-site-select').forEach((el) => {
    el.addEventListener('focus', () => {
      gsap.to(el, { scale: 1.01, y: -1, duration: 0.15, ease: EASE.snappy, overwrite: 'auto' });
    });
    el.addEventListener('blur', () => {
      gsap.to(el, { scale: 1, y: 0, duration: 0.2, ease: EASE.snappy, overwrite: 'auto' });
    });
  });
}

/* ── Init / Cleanup ── */

function init() {
  if (_inited) return;
  _inited = true;
  if (_matchReduce() || typeof ScrollTrigger === 'undefined') return;
  try {
    _initLenis();
    _initReveals();
    _initStaggers();
    _initHoverLift();
    _initMicroTap();
    _initTabTransitions();
    _initInputFocus();
    requestAnimationFrame(() => {
      try { ScrollTrigger.refresh(); } catch (_) {}
    });
  } catch (_) {}
}

function cleanup() {
  if (_revealObs) { _revealObs.disconnect(); _revealObs = null; }
  if (_staggerObs) { _staggerObs.disconnect(); _staggerObs = null; }
  ScrollTrigger.getAll().forEach((t) => t.kill());
  if (_lenis) { _lenis.destroy(); _lenis = null; }
  _inited = false;
}

function pageReady() {
  setTimeout(() => {
    try { ScrollTrigger.refresh(); } catch (_) {}
    _initReveals();
    _initStaggers();
  }, 650);
}

init();

window.__motion = { init, cleanup, pageReady };

export { init, cleanup, pageReady };
export default { init, cleanup, pageReady };
