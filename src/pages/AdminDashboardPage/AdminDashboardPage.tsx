import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminStats, type AdminStats } from "../../api/admin_stats";
import { PageLoading, useLoadingState } from "../../components/LoadingSpinner";
import styles from "./AdminDashboardPage.module.css";

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

  const { queue, volume, top_products, catalogue } = stats;
  const nothingWaiting = queue.to_confirm === 0 && queue.to_ship === 0;

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
          </div>
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
          <Tile label="Today" value={volume.today} to="/admin/orders" />
          <Tile label="Last 7 days" value={volume.last_7_days} to="/admin/orders" />
          <Tile label="Last 30 days" value={volume.last_30_days} to="/admin/orders" />
          <Tile label="All time" value={volume.all_time} to="/admin/orders" />
        </div>
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
