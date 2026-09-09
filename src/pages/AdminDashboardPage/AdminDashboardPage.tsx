import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminStats, type AdminStats } from "../../api/admin_stats";
import { PageLoading, useLoadingState } from "../../components/LoadingSpinner";
import { OrderChart } from "./OrderChart";
import styles from "./AdminDashboardPage.module.css";

/** Whole dollars: this is for judging the size of a queue, not for accounting. */
function formatMoney(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/** "4h" / "2d" — a duration nobody has to divide in their head. */
function age(hours: number): string {
  if (hours < 1) return "under an hour";
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

/**
 * A number, and the thing to do about it.
 *
 * Every tile is a link. A dashboard that reports a problem and then makes you
 * go and find it is half a feature.
 */
function Tile({
  label,
  value,
  to,
  hint,
  urgent = false,
}: {
  label: string;
  value: number | string;
  to: string;
  hint?: string;
  urgent?: boolean;
}) {
  return (
    <Link to={to} className={`${styles.tile} ${urgent ? styles.tileUrgent : ""}`}>
      <span className={styles.tileValue}>{value}</span>
      <span className={styles.tileLabel}>{label}</span>
      {hint && <span className={styles.tileHint}>{hint}</span>}
    </Link>
  );
}

export function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useLoadingState(loading);

  useEffect(() => {
    let active = true;

    // async/await rather than .then().catch().finally(). The chain form left a
    // rejection vitest reported as unhandled even though the catch demonstrably
    // ran and the error rendered - and this reads better anyway.
    void (async () => {
      try {
        const loaded = await getAdminStats();
        if (active) setStats(loaded);
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : "Could not load the dashboard.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (load.pending) {
    return <PageLoading label="Loading dashboard..." visible={load.visible} />;
  }

  if (error || !stats) {
    return (
      <div className={styles.page}>
        <h1>Dashboard</h1>
        <p className={styles.error}>{error ?? "Could not load the dashboard."}</p>
      </div>
    );
  }

  const { queue, volume, top_products, catalogue, daily } = stats;
  // The card-hold counts belong in this gate too. They also span `pending`
  // orders, which contribute to neither count above - so a lapsed hold on one
  // rendered "Nothing waiting. Every order is on its way." with the red alarm
  // suppressed behind it.
  const nothingWaiting =
    queue.to_confirm === 0 &&
    queue.to_ship === 0 &&
    (queue.authorization_expiring ?? 0) === 0 &&
    (queue.authorization_expired ?? 0) === 0;

  return (
    <div className={styles.page}>
      <h1>Dashboard</h1>

      {/*
        Needs you now, first and largest. This is what the page is opened for -
        the money and the counts are context, this is the work.
      */}
      <section className={styles.section} aria-labelledby="needs-you">
        <h2 id="needs-you">Needs you now</h2>

        {nothingWaiting ? (
          <p className={styles.allClear}>Nothing waiting. Every order is on its way.</p>
        ) : (
          <div className={styles.tiles}>
            <Tile
              label="To confirm"
              value={queue.to_confirm}
              to="/admin/orders?status=awaiting_fulfillment"
              // The age, not just the count. Three to confirm is a normal
              // morning; one that has sat four days is a customer wondering
              // whether the shop is real.
              hint={
                queue.oldest_awaiting_hours !== null
                  ? `oldest ${age(queue.oldest_awaiting_hours)}`
                  : undefined
              }
              urgent={(queue.oldest_awaiting_hours ?? 0) >= 24}
            />
            <Tile
              label="To ship"
              value={queue.to_ship}
              to="/admin/orders?status=confirmed"
            />
            <Tile
              label="In transit"
              value={queue.in_transit}
              to="/admin/orders?status=shipped"
            />
            {/*
              Only when there is something to say. Checkout authorises and the
              money moves when an admin confirms; Stripe releases an uncaptured
              hold after about a week - so these are orders that will fail at
              capture, with their stock reserved the whole time.
            */}
            {/*
              ?hold=, not ?status=. The link used to be status=all and spent
              three revisions chasing whichever statuses the count happened to
              span - which was the wrong question. status=all agreed with the
              count about membership and not about findability: the list is
              newest-first, 50 to a page, with no age filter, and these are by
              definition the oldest live orders. Past 50 orders in five days the
              admin landed on a page that could not contain any of them.

              The backend now serves this exact cohort from the same window the
              tile counts, so the two cannot drift apart again.
            */}
            {(queue.authorization_expiring ?? 0) > 0 && (
              <Tile
                label="Card holds expiring"
                value={queue.authorization_expiring ?? 0}
                to="/admin/orders?hold=expiring"
                hint="act or they lapse"
                urgent
              />
            )}
            {/*
              Separate from the above, because the advice is the opposite.
              Shipping one of these fails at capture - the hold is already gone,
              so the honest action is to cancel and return the stock.
            */}
            {(queue.authorization_expired ?? 0) > 0 && (
              <Tile
                label="Card holds expired"
                value={queue.authorization_expired ?? 0}
                to="/admin/orders?hold=expired"
                hint="capture will fail"
                urgent
              />
            )}
          </div>
        )}

        {/*
          The queue priced, so an afternoon's work is distinguishable from ten
          minutes'. Deliberately not called revenue and deliberately not next to
          one: Stripe is authoritative for money, and anything computed here
          drifts from it on fees, refunds and disputes.
        */}
        {queue.queue_value > 0 && (
          <p className={styles.sectionNote}>
            {formatMoney(queue.queue_value)} of goods awaiting shipment, before tax.{" "}
            <a
              className={styles.stripeLink}
              href="https://dashboard.stripe.com/payments"
              target="_blank"
              rel="noreferrer"
            >
              Payments are in Stripe →
            </a>
          </p>
        )}
      </section>

      <section className={styles.section} aria-labelledby="running-out">
        <h2 id="running-out">Running out</h2>

        {catalogue.low_stock.length === 0 ? (
          <p className={styles.allClear}>
            Nothing at or below {catalogue.low_stock_threshold} in stock.
          </p>
        ) : (
          <>
            <ul className={styles.stockList}>
              {catalogue.low_stock.map((v) => (
                <li key={v.variant_id} className={styles.stockRow}>
                  <Link to={`/admin/products/${v.product_id}`} className={styles.stockLink}>
                    <span className={styles.stockName}>{v.product_name}</span>
                    <span className={styles.stockVariant}>{v.variant_label}</span>
                  </Link>
                  <span className={v.stock === 0 ? styles.stockOut : styles.stockLow}>
                    {v.stock === 0 ? "out of stock" : `${v.stock} left`}
                  </span>
                </li>
              ))}
            </ul>
            {catalogue.low_stock_total > catalogue.low_stock.length && (
              <p className={styles.more}>
                and {catalogue.low_stock_total - catalogue.low_stock.length} more at or below{" "}
                {catalogue.low_stock_threshold}
              </p>
            )}
          </>
        )}
      </section>

      {/*
        A product with no variant is filtered out of the public listing, so it
        is present here and absent from the shop with nothing saying so. Only
        rendered when there is one - an always-present empty panel is noise.
      */}
      {catalogue.invisible_products.length > 0 && (
        <section className={styles.section} aria-labelledby="invisible">
          <h2 id="invisible">Not visible in the shop</h2>
          <p className={styles.sectionNote}>
            These have no variants, so customers cannot see or buy them.
          </p>
          <ul className={styles.stockList}>
            {catalogue.invisible_products.map((p) => (
              <li key={p.id} className={styles.stockRow}>
                <Link to={`/admin/products/${p.id}`} className={styles.stockLink}>
                  <span className={styles.stockName}>{p.name}</span>
                  <span className={styles.stockVariant}>{p.cat_id}</span>
                </Link>
                <span className={styles.stockOut}>no variants</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section} aria-labelledby="volume">
        <h2 id="volume">Orders</h2>
        <div className={styles.tiles}>
          {/*
            ?status=all, not a bare path. Since the order list derives its tab
            from the URL, a bare /admin/orders means "no parameter" and falls
            back to Awaiting Fulfillment - so "All time: 412" landed on a list
            of the three orders awaiting confirmation, the tile and its
            destination contradicting each other. This is the same bug the tab
            change fixed for the queue tiles, still live for these four.
          */}
          <Tile label="Today" value={volume.today} to="/admin/orders?status=all" />
          <Tile label="Last 7 days" value={volume.last_7_days} to="/admin/orders?status=all" />
          <Tile label="Last 30 days" value={volume.last_30_days} to="/admin/orders?status=all" />
          <Tile label="All time" value={volume.all_time} to="/admin/orders?status=all" />
        </div>
        {/*
          Optional chaining because the repos deploy independently and there is
          no ErrorBoundary: a frontend shipped ahead of its backend gets a
          successful /admin/stats with no `daily`, and `daily.length` would
          throw in render and blank the whole admin tree - with the network tab
          showing a perfectly healthy request.
        */}
        {daily?.length ? <OrderChart daily={daily} /> : null}
        <p className={styles.sectionNote}>Dates in {stats.timezone}. Cancelled orders excluded.</p>
      </section>

      {top_products.length > 0 && (
        <section className={styles.section} aria-labelledby="top">
          <h2 id="top">Most ordered, last 30 days</h2>
          <ul className={styles.stockList}>
            {top_products.map((p) => (
              <li key={p.product_name} className={styles.stockRow}>
                <span className={styles.stockName}>{p.product_name}</span>
                <span className={styles.stockLow}>
                  {p.units} {p.units === 1 ? "unit" : "units"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
