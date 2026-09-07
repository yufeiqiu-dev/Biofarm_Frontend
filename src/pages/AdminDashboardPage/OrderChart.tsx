import type { AdminDailyPoint } from "../../api/admin_stats";
import styles from "./OrderChart.module.css";

/**
 * Thirty days of orders: daily as bars, cumulative as a line.
 *
 * Two aggregations of the same quantity, so two scales in one frame. Dual axes
 * deserve their bad reputation when they invite a false comparison between
 * unrelated series; here the alternative is two charts of one variable each,
 * which costs more space than it earns on a page whose job is a glance. Both
 * sides are labelled with their maximum so neither scale is implied.
 *
 * Inline SVG rather than a charting library. Bars and a polyline over a date
 * axis is this much code; a library earns its weight when axes, tooltips, zoom
 * and legends are needed, and the lightest credible one would still be among
 * the heaviest things in the bundle - on the page most likely to be left open
 * all day.
 */

const WIDTH = 720;
const HEIGHT = 180;
const PAD = { top: 12, right: 38, bottom: 22, left: 30 };

const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

/**
 * "9/6" — month first.
 *
 * This read `${day}/${month}` and rendered the 6th of September as "6/9", which
 * to anyone reading a dollar-priced shop keyed to America/New_York is the 9th of
 * June. An axis label that is silently three months out is worse than no label.
 */
function shortDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${Number(month)}/${Number(day)}`;
}

export function OrderChart({ daily }: { daily: AdminDailyPoint[] }) {
  if (daily.length === 0) return null;

  const maxDaily = Math.max(1, ...daily.map((d) => d.orders));

  /*
   * The running total is scaled between its own ends, not from zero.
   *
   * The series starts at the shop's lifetime count, so a zero-based axis buys
   * almost nothing: 500 lifetime orders and 30 this month spans 500/530 to
   * 530/530 - 5.7% of the frame, a flat line pinned to the top edge. The growth
   * the line exists to show disappears exactly as the shop grows. Both ends are
   * labelled so the floor is never mistaken for zero.
   */
  const totals = daily.map((d) => d.cumulative);
  const minTotal = Math.min(...totals);
  const maxTotal = Math.max(...totals);
  const totalRange = Math.max(1, maxTotal - minTotal);
  const step = PLOT_W / daily.length;

  // A bar of literally zero height is invisible, which is correct - an empty day
  // should read as empty rather than as a sliver of activity.
  const bars = daily.map((d, i) => {
    const h = (d.orders / maxDaily) * PLOT_H;
    return {
      key: d.date,
      x: PAD.left + i * step + step * 0.15,
      y: PAD.top + PLOT_H - h,
      w: Math.max(1, step * 0.7),
      h,
      orders: d.orders,
    };
  });

  const line = daily
    .map((d, i) => {
      const x = PAD.left + i * step + step / 2;
      const y = PAD.top + PLOT_H - ((d.cumulative - minTotal) / totalRange) * PLOT_H;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const first = daily[0];
  const last = daily[daily.length - 1];
  const totalInWindow = daily.reduce((sum, d) => sum + d.orders, 0);

  return (
    <figure className={styles.figure}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className={styles.chart}
        role="img"
        // The chart is decorative to a screen reader without this; the numbers
        // beneath it are the accessible version of the same fact.
        aria-label={`Orders per day from ${first.date} to ${last.date}. ${totalInWindow} in the period, ${last.cumulative} in total.`}
      >
        <line
          x1={PAD.left}
          y1={PAD.top + PLOT_H}
          x2={WIDTH - PAD.right}
          y2={PAD.top + PLOT_H}
          className={styles.axis}
        />

        {bars.map((b) => (
          <rect key={b.key} x={b.x} y={b.y} width={b.w} height={b.h} className={styles.bar} />
        ))}

        <polyline points={line} className={styles.line} />

        <text x={0} y={PAD.top + 4} className={styles.tick}>
          {maxDaily}
        </text>
        <text x={WIDTH - PAD.right + 6} y={PAD.top + 4} className={styles.tickTotal}>
          {maxTotal}
        </text>
        {/* The floor, so a line that starts high is not read as starting at zero. */}
        <text x={WIDTH - PAD.right + 6} y={PAD.top + PLOT_H} className={styles.tickTotal}>
          {minTotal}
        </text>
        <text x={PAD.left} y={HEIGHT - 6} className={styles.tick}>
          {shortDate(first.date)}
        </text>
        <text x={WIDTH - PAD.right} y={HEIGHT - 6} className={styles.tick} textAnchor="end">
          {shortDate(last.date)}
        </text>
      </svg>

      <figcaption className={styles.legend}>
        <span className={styles.keyBar} /> orders per day
        <span className={styles.keyLine} /> running total
      </figcaption>
    </figure>
  );
}
