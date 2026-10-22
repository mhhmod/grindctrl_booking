'use client';

import * as React from 'react';
import { Button } from '@mantine/core';
import { GcIcon } from '@/components/icons';
import { BOOKING_URL } from '@/lib/booking';
import { getPlanCopy } from '@/lib/dashboard/plan-copy';
import type { ChartPoint, PlanChart, PlanView } from '@/lib/dashboard/plan-model';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import classes from './v16-plan.module.css';

/* The v16 Plan page (04-dashboard.md, the Plan board), for owners. The
   model in lib/dashboard/plan-model.ts decides what has a source; this file
   lays it out. The chart follows the dataviz rules: one series and its
   projection (dashed, the only dashing), the plan as a hairline reference,
   the run-out stretch as a labelled band, a crosshair that also answers the
   keyboard, and the numbers as a table. On phones it is a meter. */

const W = 640;
const H = 220;
const PAD = { top: 24, right: 72, bottom: 28, left: 8 };

function UsageChart({ chart, locale }: { chart: PlanChart; locale: SiteLocale }) {
  const copy = getPlanCopy(locale);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  // Headroom above the plan line keeps the band's label clear of it.
  const top = Math.max(chart.limit, ...chart.projection.map((p) => p.used), ...chart.used.map((p) => p.used), 1) * 1.3;
  const x = (at: number) => PAD.left + ((at - chart.start) / (chart.end - chart.start)) * plotW;
  const y = (used: number) => PAD.top + plotH - (used / top) * plotH;
  const path = (points: ChartPoint[]) => points.map((p, i) => `${i ? 'L' : 'M'}${x(p.at).toFixed(1)},${y(p.used).toFixed(1)}`).join(' ');
  const last = chart.used[chart.used.length - 1];
  const area = chart.used.length
    ? `${path(chart.used)} L${x(last.at).toFixed(1)},${y(0)} L${x(chart.used[0].at).toFixed(1)},${y(0)} Z`
    : '';
  // The crosshair stops at each day used so far and at the projection's end.
  const stops = React.useMemo(
    () => [
      ...chart.used.map((p, i) => ({ ...p, tip: (i === chart.used.length - 1 ? copy.tipToday : copy.tipUsed)(p.label, p.used) })),
      ...chart.projection.slice(1).map((p) => ({ ...p, tip: copy.tipPace(p.label, p.used) })),
    ],
    [chart, copy],
  );
  const [active, setActive] = React.useState<number | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  function pick(clientX: number) {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box || stops.length === 0) return;
    const at = chart.start + ((((clientX - box.left) / box.width) * W - PAD.left) / plotW) * (chart.end - chart.start);
    let best = 0;
    stops.forEach((s, i) => {
      if (Math.abs(s.at - at) < Math.abs(stops[best].at - at)) best = i;
    });
    setActive(best);
  }

  /** The baseline that keeps today's label clear of the dashed line rising
   *  ahead of it: above where the line is at the label's far end. */
  function earlyLabelY(label: string) {
    const base = y(last.used) - 10;
    const end = chart.projection[chart.projection.length - 1];
    if (!end || end.at <= last.at) return base;
    const far = x(last.at) + 8 + label.length * 7.5;
    const lineY = y(last.used) + (y(end.used) - y(last.used)) * Math.min(1, (far - x(last.at)) / (x(end.at) - x(last.at)));
    return Math.max(14, Math.min(base, lineY - 8));
  }

  const point = active === null ? null : stops[active];
  return (
    <figure className={classes.figure}>
      <div className={classes.legend} aria-hidden="true">
        <span className={classes.key}>
          <span className={classes.keyLine} />
          {copy.chartUsed}
        </span>
        {chart.projection.length > 0 && (
          <span className={classes.key}>
            <span className={`${classes.keyLine} ${classes.keyDashed}`} />
            {copy.chartPace}
          </span>
        )}
        {chart.noTryOn && (
          <span className={classes.key}>
            <span className={classes.keyBand} />
            {copy.chartNoTryOn}
          </span>
        )}
      </div>
      <div className={classes.plot} dir="ltr">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className={classes.svg}
          role="img"
          aria-label={`${copy.chartTitle}. ${chart.description}`}
          tabIndex={0}
          onPointerMove={(e) => pick(e.clientX)}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive(stops.length ? Math.max(0, chart.used.length - 1) : null)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            setActive((i) => Math.min(stops.length - 1, Math.max(0, (i ?? 0) + (e.key === 'ArrowRight' ? 1 : -1))));
          }}
        >
          {chart.noTryOn && (
            <g>
              <rect
                x={x(chart.noTryOn.from)}
                y={PAD.top}
                width={Math.max(0, x(chart.noTryOn.to) - x(chart.noTryOn.from))}
                height={plotH}
                className={classes.band}
              />
              <text x={x(chart.noTryOn.to) - 6} y={PAD.top + 14} textAnchor="end" className={classes.bandLabel}>
                {chart.noTryOn.label}
              </text>
            </g>
          )}
          <line x1={PAD.left} x2={PAD.left + plotW} y1={y(0)} y2={y(0)} className={classes.axis} />
          <line x1={PAD.left} x2={PAD.left + plotW} y1={y(chart.limit)} y2={y(chart.limit)} className={classes.limit} />
          <text x={PAD.left + plotW + 6} y={y(chart.limit) + 4} className={classes.limitLabel}>
            {chart.limitLabel}
          </text>
          {area && <path d={area} className={classes.area} />}
          {chart.used.length > 1 && <path d={path(chart.used)} className={classes.line} />}
          {chart.projection.length > 1 && <path d={path(chart.projection)} className={`${classes.line} ${classes.dashed}`} />}
          {last && (
            <g>
              <circle cx={x(last.at)} cy={y(last.used)} r={4} className={classes.dot} />
              {/* Above and behind today, where the line has been, once there is room;
                  early in the cycle, ahead of today and above the projection. */}
              {x(last.at) - PAD.left > 150 ? (
                <text x={x(last.at) - 8} y={y(last.used) - 10} textAnchor="end" className={classes.todayLabel}>
                  {chart.todayLabel}
                </text>
              ) : (
                <text x={x(last.at) + 8} y={earlyLabelY(chart.todayLabel)} className={classes.todayLabel}>
                  {chart.todayLabel}
                </text>
              )}
            </g>
          )}
          <text x={PAD.left} y={H - 8} className={classes.tick}>
            {chart.used[0]?.label}
          </text>
          <text x={PAD.left + plotW} y={H - 8} textAnchor="end" className={classes.tick}>
            {chart.endLabel}
          </text>
          {point && (
            <g aria-hidden="true">
              <line x1={x(point.at)} x2={x(point.at)} y1={PAD.top} y2={y(0)} className={classes.crosshair} />
              <circle cx={x(point.at)} cy={y(point.used)} r={5} className={classes.dot} />
            </g>
          )}
        </svg>
        {point && (
          <div
            className={classes.tooltip}
            role="status"
            style={{ insetInlineStart: `${Math.min(80, Math.max(0, (x(point.at) / W) * 100))}%` }}
          >
            {point.tip}
          </div>
        )}
      </div>
      <details className={classes.table}>
        <summary>{copy.seeNumbers}</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">{copy.day}</th>
              <th scope="col">{copy.looksUsed}</th>
            </tr>
          </thead>
          <tbody>
            {chart.used.map((p) => (
              <tr key={p.at}>
                <td>{p.label}</td>
                <td>{p.used}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function Badge({ tone, label }: { tone: 'ok' | 'attention' | 'danger'; label: string }) {
  return (
    <span className={classes.badge} data-tone={tone}>
      <GcIcon name={tone === 'ok' ? 'check' : tone === 'attention' ? 'clock' : 'warn'} size={14} />
      {label}
    </span>
  );
}

export function V16Plan({ view, locale }: { view: PlanView; locale: SiteLocale }) {
  const copy = getPlanCopy(locale);
  const book = (
    <Button component="a" href={BOOKING_URL} target="_blank" rel="noopener noreferrer" radius="pill" variant="default" rightSection={<GcIcon name="ext" size={15} />}>
      {copy.bookCall}
    </Button>
  );
  return (
    <div className={classes.page}>
      <div className={classes.intro}>
        <p className={classes.muted}>{copy.subtitle}</p>
        {book}
      </div>

      <div className={classes.cols}>
        <section aria-labelledby="plan-looks" className={`${classes.card} ${classes.section}`}>
          <div className={classes.headRow}>
            <div className={classes.headline}>
              <h2 id="plan-looks" className={classes.label}>
                {copy.looksThisCycle}
              </h2>
              <p className={classes.big}>{view.headline.left}</p>
              <p className={classes.muted}>{view.headline.sub}</p>
              {view.headline.added && <p className={classes.muted}>{view.headline.added}</p>}
            </div>
            {view.headline.badge && <Badge {...view.headline.badge} />}
          </div>
          {view.chart && (
            <div className={classes.chartWide}>
              <UsageChart chart={view.chart} locale={locale} />
            </div>
          )}
          {view.meter && (
            <div className={classes.meterNarrow}>
              <div
                className={classes.meter}
                role="meter"
                aria-valuemin={0}
                aria-valuemax={view.meter.limit}
                aria-valuenow={view.meter.used}
                aria-label={copy.chartTitle}
              >
                <span style={{ inlineSize: `${view.meter.limit ? Math.min(100, (view.meter.used / view.meter.limit) * 100) : 0}%` }} />
              </div>
              <p className={classes.muted}>{view.chart?.todayLabel}</p>
            </div>
          )}
          {(view.pace || view.hides) && (
            <div className={classes.panel}>
              {view.pace && <p>{view.pace}</p>}
              {view.hides && <p className={view.pace ? classes.muted : undefined}>{view.hides}</p>}
            </div>
          )}
        </section>

        <div className={classes.side}>
          {view.plan && (
            <section aria-labelledby="plan-yours" className={`${classes.card} ${classes.section}`}>
              <div className={classes.headRow}>
                <h2 id="plan-yours" className={classes.label}>
                  {copy.yourPlan}
                </h2>
                <Badge tone={view.plan.tone} label={view.plan.status} />
              </div>
              <p className={classes.planName}>
                <bdi>{view.plan.name}</bdi>
                {view.plan.price && <span className={classes.price}>{view.plan.price}</span>}
              </p>
              {(view.plan.line || view.plan.renews) && (
                <p className={classes.muted}>{[view.plan.line, view.plan.renews].filter(Boolean).join(' ')}</p>
              )}
              <a href="#plan-list" className={classes.link}>
                {copy.comparePlans}
              </a>
            </section>
          )}

          {view.cycles && (
            <section aria-labelledby="plan-cycles" className={`${classes.card} ${classes.section}`}>
              <h2 id="plan-cycles" className={classes.label}>
                {copy.lastCycles}
              </h2>
              <ul className={classes.cycles}>
                {view.cycles.rows.map((row) => {
                  const top = Math.max(view.cycles!.limit, ...view.cycles!.rows.map((r) => r.used), 1);
                  return (
                    <li key={row.label} className={classes.cycle} data-current={row.current}>
                      <span className={classes.cycleLabel}>{row.label}</span>
                      <span className={classes.cycleBar} aria-hidden="true">
                        <span style={{ inlineSize: `${(row.used / top) * 100}%` }} />
                        <span className={classes.cycleLimit} style={{ insetInlineStart: `${(view.cycles!.limit / top) * 100}%` }} />
                      </span>
                      <span className={classes.cycleValue}>{row.used}</span>
                    </li>
                  );
                })}
              </ul>
              <p className={classes.muted}>{view.cycles.limitLabel}</p>
            </section>
          )}
        </div>
      </div>

      <section aria-labelledby="plan-runout" className={`${classes.card} ${classes.section}`}>
        <div>
          <h2 id="plan-runout" className={classes.h2}>
            {copy.ifYouRunOut}
          </h2>
          <p className={classes.muted}>{copy.nothingBreaks}</p>
        </div>
        <ul className={classes.facts}>
          <li>
            <GcIcon name="shirt" size={18} />
            <span>
              <strong>{copy.hidesByItself}</strong> {copy.hidesByItselfLine}
            </span>
          </li>
          <li>
            <GcIcon name="chat" size={18} />
            <span>
              <strong>{copy.chatKeepsWorking}</strong> {copy.chatKeepsWorkingLine}
            </span>
          </li>
        </ul>
      </section>

      {view.plans.length > 0 && (
        <section id="plan-list" aria-labelledby="plan-plans" className={`${classes.card} ${classes.section}`}>
          <div>
            <h2 id="plan-plans" className={classes.h2}>
              {copy.plans}
            </h2>
            <p className={classes.muted}>{copy.plansLine}</p>
          </div>
          <ul className={classes.plans}>
            {view.plans.map((plan) => (
              <li key={plan.key} className={classes.planCard} data-current={plan.current}>
                <span className={classes.planCardName}>
                  <bdi>{plan.name}</bdi>
                  {plan.current && <span className={classes.current}>{copy.current}</span>}
                </span>
                <span className={classes.planCardPrice}>{plan.price}</span>
                <span className={classes.muted}>{plan.looks}</span>
              </li>
            ))}
          </ul>
          <div className={classes.change}>
            <p className={classes.muted}>{copy.changePlan}</p>
            {book}
          </div>
        </section>
      )}
    </div>
  );
}

export function V16PlanError({ locale }: { locale: SiteLocale }) {
  return (
    <p className={`${classes.card} ${classes.error}`} role="status">
      {getPlanCopy(locale).couldNotLoad}
    </p>
  );
}
