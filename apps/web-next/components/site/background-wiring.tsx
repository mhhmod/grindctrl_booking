'use client';

/* The quiet system behind each scene: thin lines, small square nodes and
   pulses running along the lines, plus a short trace log at the start edge
   on wide screens. Purely decorative, so aria-hidden and out of the tab
   order. The trace is drawn as SVG text inside the hidden layer so its faint
   colour is never mistaken for body copy.

   The layer is fixed to the viewport and clipped to its own section, so
   lines continue across scenes as the story's sheets slide. It animates only
   while its section is on screen and the tab is visible. Paths come from the
   prototype's env11.py (1440 x 900 desktop grid, 390 x 844 phone grid).

   Only the lines are painted. Everything that moves is its own small element
   animated with transform or opacity, which the GPU compositor runs without
   repainting. Animating the SVG itself (a dash offset, a node's opacity)
   repainted this full-screen layer on every frame, and on phones that
   starved the GPU until other layers showed with tiles missing. */

import * as React from 'react';
import { cn } from '@/lib/utils';

/** A line, its pulse's loop in seconds and head start, and its length in viewBox units. */
type Wire = [d: string, duration: number, delay: number, length: number];

const DESK_WIRES: Wire[] = [
  ['M58 150 V512 Q58 540 86 540 H112', 9.5, 0, 433.5],
  ['M58 512 V786 Q58 814 86 814 H420', 12, 3.1, 653.5],
  ['M1382 132 V368 Q1382 396 1354 396 H1328', 10.5, 1.4, 307.5],
  ['M1382 640 V786 Q1382 814 1354 814 H1020', 11, 5.2, 525.5],
  ['M420 814 H1020', 14, 7, 600],
];
const DESK_NODES: Array<[number, number]> = [
  [58, 150], [58, 300], [58, 430], [112, 540], [58, 700], [1382, 132],
  [1382, 250], [1328, 396], [1382, 700], [720, 814], [560, 814], [880, 814],
];
const PHONE_WIRES: Wire[] = [
  ['M7 120 V700 Q7 724 31 724 H150', 10, 0, 738],
  ['M383 160 V700 Q383 724 359 724 H240', 11, 2.6, 698],
];
const PHONE_NODES: Array<[number, number]> = [[7, 120], [7, 380], [383, 160], [383, 460], [150, 724], [240, 724]];

const DESK_BOX = [1440, 900] as const;
const PHONE_BOX = [390, 844] as const;

/* A pulse is 3% of its line, drawn 2 units thick with round ends. */
const PULSE = 0.03;

function Drawing({
  wires,
  nodes,
  box: [w, h],
  scale,
}: {
  wires: Wire[];
  nodes: Array<[number, number]>;
  box: readonly [number, number];
  /** The CSS variable holding this grid's cover scale for the viewport. */
  scale: string;
}) {
  return (
    <>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 block rtl:-scale-x-100"
      >
        {wires.map(([d]) => (
          <path key={d} d={d} fill="none" stroke="var(--gc-wire-line)" strokeWidth={1} />
        ))}
      </svg>
      {/* The same grid in CSS pixels, scaled to cover the viewport the way
          the SVG's slice does, so pulses and nodes sit on the lines. */}
      <div
        className="gc-wire-grid"
        style={{ width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2, '--gc-wire-k': `var(${scale}, 1)` } as React.CSSProperties}
      >
        {wires.map(([d, duration, delay, length]) => (
          <i
            key={d}
            className="gc-wire-pulse"
            style={{
              offsetPath: `path('${d}')`,
              width: length * PULSE + 2,
              animationDuration: `${duration}s`,
              animationDelay: `${-delay}s`,
            }}
          />
        ))}
        {nodes.map(([x, y], index) => (
          <i
            key={`${x}-${y}`}
            className="gc-wire-node"
            style={{ left: x - 3, top: y - 3, animationDelay: `${-((index * 0.9) % 6)}s` }}
          />
        ))}
      </div>
    </>
  );
}

const LOG_WIDTH = 180;

function TraceLog({ steps }: { steps: string[] }) {
  /* Two logs, one per direction, so the dot sits on the reading-start side
     and the text runs away from it in both languages. Each row is its own
     small SVG, so its fade is an opacity change the compositor can run. */
  const rows = (rtl: boolean) =>
    steps.map((step, index) => (
      <svg
        key={step}
        width={LOG_WIDTH}
        height={18}
        className="gc-wire-step block overflow-visible"
        style={{ animationDelay: `${index * 3 - 12}s` }}
      >
        <g transform="translate(0 9)">
          <circle cx={rtl ? LOG_WIDTH - 2.5 : 2.5} cy={0} r={2.5} fill="currentColor" />
          <text
            x={rtl ? LOG_WIDTH - 12 : 12}
            y={3.5}
            fontSize={10}
            fontWeight={600}
            fill="currentColor"
            textAnchor="start"
            direction={rtl ? 'rtl' : 'ltr'}
          >
            {step}
          </text>
        </g>
      </svg>
    ));
  const base = 'absolute top-[calc(50%+150px)] hidden';
  return (
    <>
      <div style={{ width: LOG_WIDTH }} className={cn(base, 'left-5 min-[1200px]:ltr:block')}>
        {rows(false)}
      </div>
      <div style={{ width: LOG_WIDTH }} className={cn(base, 'right-5 min-[1200px]:rtl:block')}>
        {rows(true)}
      </div>
    </>
  );
}

export function BackgroundWiring({
  trace,
  lane = true,
  className,
}: {
  /** Four short trace lines for this scene or page, from the copy files. */
  trace?: string[];
  /** Long pages keep only the side rails, so no line runs through the footer. */
  lane?: boolean;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const layer = React.useRef<HTMLDivElement>(null);

  /* The cover scale of each grid for the viewport, which CSS cannot divide
     out of two lengths. Until it is set the moving parts stay hidden. */
  React.useEffect(() => {
    const node = layer.current;
    if (!node) return;
    const measure = () => {
      const width = node.clientWidth;
      const height = node.clientHeight;
      if (!width || !height) return;
      node.style.setProperty('--gc-wire-kd', String(Math.max(width / DESK_BOX[0], height / DESK_BOX[1])));
      node.style.setProperty('--gc-wire-kp', String(Math.max(width / PHONE_BOX[0], height / PHONE_BOX[1])));
      node.dataset.scaled = '';
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(node);
    return () => observer?.disconnect();
  }, []);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let onScreen = false;
    const sync = () => {
      if (onScreen && document.visibilityState === 'visible') node.dataset.live = '';
      else delete node.dataset.live;
    };
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver((entries) => {
            onScreen = entries.some((entry) => entry.isIntersecting);
            sync();
          });
    observer?.observe(node);
    document.addEventListener('visibilitychange', sync);
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  const deskWires = lane ? DESK_WIRES : DESK_WIRES.filter(([d]) => !d.includes('814'));
  const deskNodes = lane ? DESK_NODES : DESK_NODES.filter(([, y]) => y !== 814);
  const phoneWires = lane ? PHONE_WIRES : PHONE_WIRES.filter(([d]) => !d.includes('724'));
  const phoneNodes = lane ? PHONE_NODES : PHONE_NODES.filter(([, y]) => y !== 724);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-wiring=""
      className={cn('pointer-events-none absolute inset-0 z-0 [clip-path:inset(0)]', className)}
    >
      <div ref={layer} className="fixed inset-0 text-foreground/60">
        <div className="absolute inset-0 hidden lg:block">
          <Drawing wires={deskWires} nodes={deskNodes} box={DESK_BOX} scale="--gc-wire-kd" />
        </div>
        <div className="absolute inset-0 lg:hidden">
          <Drawing
            wires={phoneWires.length ? phoneWires : PHONE_WIRES.slice(0, 1)}
            nodes={phoneNodes}
            box={PHONE_BOX}
            scale="--gc-wire-kp"
          />
        </div>
        {trace?.length ? <TraceLog steps={trace} /> : null}
      </div>
    </div>
  );
}
