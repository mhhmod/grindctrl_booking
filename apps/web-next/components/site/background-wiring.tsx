'use client';

/* The quiet system behind each scene: thin lines, small square nodes and
   pulses running along the lines, plus a short trace log at the start edge
   on wide screens. Purely decorative, so aria-hidden and out of the tab
   order. The trace is drawn as SVG text inside the hidden layer so its faint
   colour is never mistaken for body copy.

   The layer is fixed to the viewport and clipped to its own section, so
   lines continue across scenes as the story's sheets slide. It animates only
   while its section is on screen and the tab is visible. Paths come from the
   prototype's env11.py (1440 x 900 desktop grid, 390 x 844 phone grid). */

import * as React from 'react';
import { cn } from '@/lib/utils';

type Wire = [d: string, duration: number, delay: number];

const DESK_WIRES: Wire[] = [
  ['M58 150 V512 Q58 540 86 540 H112', 9.5, 0],
  ['M58 512 V786 Q58 814 86 814 H420', 12, 3.1],
  ['M1382 132 V368 Q1382 396 1354 396 H1328', 10.5, 1.4],
  ['M1382 640 V786 Q1382 814 1354 814 H1020', 11, 5.2],
  ['M420 814 H1020', 14, 7],
];
const DESK_NODES: Array<[number, number]> = [
  [58, 150], [58, 300], [58, 430], [112, 540], [58, 700], [1382, 132],
  [1382, 250], [1328, 396], [1382, 700], [720, 814], [560, 814], [880, 814],
];
const PHONE_WIRES: Wire[] = [
  ['M7 120 V700 Q7 724 31 724 H150', 10, 0],
  ['M383 160 V700 Q383 724 359 724 H240', 11, 2.6],
];
const PHONE_NODES: Array<[number, number]> = [[7, 120], [7, 380], [383, 160], [383, 460], [150, 724], [240, 724]];

function Drawing({ wires, nodes, viewBox }: { wires: Wire[]; nodes: Array<[number, number]>; viewBox: string }) {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 block rtl:-scale-x-100"
    >
      {wires.map(([d]) => (
        <path key={`l${d}`} d={d} fill="none" stroke="var(--gc-wire-line)" strokeWidth={1} />
      ))}
      {wires.map(([d, duration, delay]) => (
        <path
          key={`p${d}`}
          d={d}
          pathLength={100}
          fill="none"
          stroke="var(--gc-wire-pulse)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="3 97"
          className="gc-wire-pulse"
          style={{ animationDuration: `${duration}s`, animationDelay: `${-delay}s` }}
        />
      ))}
      {nodes.map(([x, y], index) => (
        <rect
          key={`${x}-${y}`}
          x={x - 3}
          y={y - 3}
          width={6}
          height={6}
          rx={1.5}
          fill="var(--gc-wire-node)"
          className="gc-wire-node"
          style={{ animationDelay: `${-((index * 0.9) % 6)}s` }}
        />
      ))}
    </svg>
  );
}

const LOG_WIDTH = 180;

function TraceLog({ steps }: { steps: string[] }) {
  /* Two drawings, one per direction, so the dot sits on the reading-start
     side and the text runs away from it in both languages. */
  const rows = (rtl: boolean) =>
    steps.map((step, index) => (
      <g
        key={step}
        className="gc-wire-step"
        style={{ animationDelay: `${index * 3 - 12}s` }}
        transform={`translate(0 ${index * 18 + 9})`}
      >
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
    ));
  const base = 'absolute top-[calc(50%+150px)] hidden overflow-visible';
  return (
    <>
      <svg width={LOG_WIDTH} height={steps.length * 18} className={cn(base, 'left-5 min-[1200px]:ltr:block')}>
        {rows(false)}
      </svg>
      <svg width={LOG_WIDTH} height={steps.length * 18} className={cn(base, 'right-5 min-[1200px]:rtl:block')}>
        {rows(true)}
      </svg>
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
      <div className="fixed inset-0 text-foreground/60">
        <div className="absolute inset-0 hidden lg:block">
          <Drawing wires={deskWires} nodes={deskNodes} viewBox="0 0 1440 900" />
        </div>
        <div className="absolute inset-0 lg:hidden">
          <Drawing wires={phoneWires.length ? phoneWires : PHONE_WIRES.slice(0, 1)} nodes={phoneNodes} viewBox="0 0 390 844" />
        </div>
        {trace?.length ? <TraceLog steps={trace} /> : null}
      </div>
    </div>
  );
}
