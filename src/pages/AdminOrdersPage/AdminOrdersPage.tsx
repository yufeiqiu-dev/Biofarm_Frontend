import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { adminListOrders } from "../../api/admin_order";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { Pager } from "../../components/Pager";
import { PageLoading, useLoadingState } from "../../components/LoadingSpinner";
import type { AdminOrder, OrderStatus } from "../../types/order_types";
import styles from "./AdminOrdersPage.module.css";

// Matches the backend default. A page the server would not return is a page
// the console should not ask for.
const PAGE_SIZE = 50;

const TABS: { label: string; value: string | null }[] = [
  { label: "All", value: null },
  { label: "Awaiting Fulfillment", value: "awaiting_fulfillment" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Shipped", value: "shipped" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

/*
 * The card-hold cohorts the dashboard tiles link to. The server owns the actual
 * window; these are the labels and the whitelist.
 *
 * The advice differs between them, which is why they are two cohorts and not
 * one "old orders" bucket - shipping an already-lapsed order fails at capture.
 */
const HOLDS: { value: string; heading: string; advice: string }[] = [
  {
    value: "expiring",
    heading: "Card holds expiring",
    advice:
      // Hedged on which action, because the cohort is every live unshipped
      // status and they do not share one. A confirmed order (confirmed before
      // capture moved, so still holding an uncaptured hold) ships; an awaiting
      // one confirms; a pending one can do neither - update_order_status
      // rejects both transitions and the detail page renders neither button, so
      // naming them told an admin to do something the console will not let them
      // do. Cancel is the action available on all three.
      "These authorisations run out within days. Move each order forward where you can, to take the money while it is still there; where you cannot, cancel to release the hold and return the stock.",
  },
  {
    value: "expired",
    heading: "Card holds expired",
    advice:
      "These authorisations have lapsed, so confirming or shipping will fail at capture. Cancel them to return the stock they are still holding.",
  },
];

const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  pending: styles.badgePending,
  awaiting_fulfillment: styles.badgeAwaiting,
  confirmed: styles.badgeConfirmed,
  shipped: styles.badgeShipped,
  delivered: styles.badgeDelivered,
  cancelled: styles.badgeCancelled,
};

// Module-level, so the renders where no result for the active request has
// arrived yet are not handed a fresh array each pass.
const EMPTY_ORDERS: AdminOrder[] = [];

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  awaiting_fulfillment: "Awaiting",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function AdminOrdersPage() {
  const navigate = useNavigate();
  /*
   * The tab comes from the URL, so a link can point at one.
   *
   * It was local state with a fixed default, which meant /admin/orders?status=confirmed
   * silently showed Awaiting Fulfillment - the dashboard's "0 to ship" tile
   * looked like a filter and was ignored. Selecting a tab writes the parameter
   * back, so the view is also shareable and survives a reload.
   *
   * Validated against TABS: an unknown status in the URL falls back rather than
   * selecting nothing and rendering an empty list that looks like "no orders".
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("status");
  /*
   * The card-hold cohorts, arriving from the dashboard tiles.
   *
   * Validated here rather than passed through, so a typo in a hand-edited URL
   * cannot show every order under a heading promising only the at-risk ones.
   */
  const requestedHold = searchParams.get("hold");
  const hold = HOLDS.some((h) => h.value === requestedHold) ? requestedHold : null;
  // No parameter at all is not the same as ?status=all. TABS contains a null
  // value for the "All" tab, so a bare `TABS.some(t => t.value === requested)`
  // matched `null` and quietly made the unfiltered view the default.
  /*
   * A hold cohort spans pending, awaiting_fulfillment *and* confirmed, so
   * defaulting to the Awaiting Fulfillment tab would hide part of the very set
   * the tile counted - the same "the link shows a subset of the count" bug the
   * hold filter exists to fix. An explicit ?status= still wins.
   */
  const activeTab =
    requested === null
      ? hold
        ? null
        : "awaiting_fulfillment"
      : requested === "all"
        ? null
        : TABS.some((t) => t.value === requested)
          ? requested
          : "awaiting_fulfillment";

  const setActiveTab = (value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("status", value);
    else next.set("status", "all");
    // Picking a tab means "show me this instead". Keeping the hold filter would
    // silently intersect the two and render an empty list that reads as "no
    // orders" rather than "no orders matching both".
    next.delete("hold");
    setSearchParams(next, { replace: true });
  };

  const activeHold = HOLDS.find((h) => h.value === hold) ?? null;

  const clearHold = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("hold");
    // status=all explicitly, not just "no hold". A tile links here with no
    // status parameter at all, and a bare delete left `requested === null`,
    // which falls back to the Awaiting Fulfillment tab - so a button labelled
    // "Show all orders" showed fewer, and the pending and confirmed orders the
    // admin had been looking at disappeared with nothing to explain it.
    next.set("status", "all");
    setSearchParams(next, { replace: true });
  };
  const [search, setSearch] = useState("");

  // One piece of state carrying which tab it answers, rather than separate
  // orders/loading/error. That fixes two things at once.
  //
  // The race: the previous version had no cleanup, so switching tabs quickly
  // left two requests in flight and whichever answered last won. Click through
  // Confirmed, Shipped, Delivered and you could be left looking at Confirmed's
  // orders under the Delivered tab, with nothing to indicate it.
  //
  // The cascading render: it also called setLoading and setError synchronously
  // in the effect body, so every tab change rendered twice before any request
  // was even sent. Loading is derived here instead - there is nothing to store.
  const [page, setPage] = useState(0);

  // Typing is not a request per keystroke. Without the delay the answers can
  // also arrive out of order and leave the list showing results for a prefix of
  // what was typed.
  const query = useDebouncedValue(search, 300);

  // Back to the first page whenever the question changes. Searching from page
  // three otherwise asks for offset 100 of a two-row result and renders an
  // empty page that looks like "no matches".
  const [askedFor, setAskedFor] = useState({ tab: activeTab, query, hold });
  if (askedFor.tab !== activeTab || askedFor.query !== query || askedFor.hold !== hold) {
    setAskedFor({ tab: activeTab, query, hold });
    setPage(0);
  }

  const offset = page * PAGE_SIZE;

  // One piece of state carrying which request it answers. The key has to cover
  // every input, not just the tab: with only the tab, a slow response for one
  // search term would be accepted as the answer to another.
  const [result, setResult] = useState<{
    key: string;
    orders: AdminOrder[];
    total: number;
    error: string | null;
  } | null>(null);

  const requestKey = `${activeTab ?? "all"}|${query}|${hold ?? ""}|${offset}`;

  useEffect(() => {
    let ignore = false;
    adminListOrders({
      status: activeTab ?? undefined,
      q: query || undefined,
      hold: hold ?? undefined,
      limit: PAGE_SIZE,
      offset,
    })
      .then((body) => {
        if (!ignore) {
          setResult({ key: requestKey, orders: body.items, total: body.total, error: null });
        }
      })
      .catch((e) => {
        if (!ignore) {
          setResult({
            key: requestKey,
            orders: [],
            total: 0,
            error: e instanceof Error ? e.message : "Failed to load orders.",
          });
        }
      });
    return () => {
      ignore = true;
    };
  }, [activeTab, query, hold, offset, requestKey]);

  const isCurrent = result !== null && result.key === requestKey;
  const loading = !isCurrent;
  const load = useLoadingState(loading);
  const filtered = isCurrent ? result.orders : EMPTY_ORDERS;
  const error = isCurrent ? result.error : null;

  /*
   * The rows are cleared between requests, but the count is not.
   *
   * Pager renders nothing when total is at or below one page, so zeroing this
   * while a request was in flight removed the whole control from the DOM on
   * every page turn. Three things went wrong with that: `busy` could never
   * disable a button that no longer existed, keyboard focus sitting on "Next"
   * was destroyed and dumped back on the body, and a failed request left the
   * count at zero for good - stranding an admin on page two with an error and
   * no way back to page one.
   *
   * Keeping the last count means the controls stay put while the next page
   * loads, which is also what makes `busy` meaningful.
   */
  const [lastKnownTotal, setLastKnownTotal] = useState(0);
  if (isCurrent && result.error === null && result.total !== lastKnownTotal) {
    setLastKnownTotal(result.total);
  }
  const total = isCurrent && result.error === null ? result.total : lastKnownTotal;


  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1>Orders</h1>
        {/*
          "account email" rather than just "email" because those are now two
          different things: the order carries where the customer asked mail to
          go, and the search also resolves their account address against
          Cognito. Support hears about this precisely when the first one was
          typed wrong, so the address the admin has in front of them is the
          account one - and nothing would tell them that works.
        */}
        <input
          className={styles.searchInput}
          type="search"
          placeholder="Search by order #, name, account email, or customer ID…"
          aria-label="Search orders"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.label}
            className={`${styles.tab} ${activeTab === tab.value ? styles.active : ""}`}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/*
        Says what is being shown and what to do about it. Without it the list is
        indistinguishable from an ordinary filtered view, and an admin arriving
        from a red tile has no idea these orders need the opposite action from
        the ones above them.
      */}
      {activeHold && (
        <div className={styles.holdNotice} role="status">
          <div>
            <strong className={styles.holdHeading}>{activeHold.heading}</strong>
            <p className={styles.holdAdvice}>{activeHold.advice}</p>
          </div>
          <button type="button" className={styles.holdClear} onClick={clearHold}>
            Show all orders
          </button>
        </div>
      )}

      {error && <p style={{ color: "#dc2626" }}>Error: {error}</p>}

      {load.pending ? (
        <PageLoading compact visible={load.visible} />
      ) : filtered.length === 0 ? (
        <p>
          {/*
            The reassuring line only when there is something to be reassured
            about. A failed request also lands here with an empty list, so an
            admin clicking the red "Card holds expired" tile during a backend
            blip read "Error: Failed to fetch" directly above a confident claim
            that the at-risk orders had been dealt with.
          */}
          {error
            ? "Orders could not be loaded."
            : search
              ? "No orders match your search."
              : activeHold
                ? "Nothing in this cohort any more - it has been dealt with."
                : "No orders found."}
        </p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Order #</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => (
              <tr key={order.id} onClick={() => navigate(`/admin/orders/${order.id}`)}>
                <td>#{order.order_number}</td>
                <td>
                  {order.customer_email ? (
                    <span>{order.customer_email}</span>
                  ) : (
                    <span title={order.user_id}>{order.shipping_name}</span>
                  )}
                </td>
                <td>{new Date(order.created_at).toLocaleDateString()}</td>
                <td>{order.items.length}</td>
                <td>${(order.total_amount + (order.shipping_amount ?? 0) + order.tax_amount).toFixed(2)}</td>
                <td>
                  <span className={`${styles.badge} ${STATUS_BADGE_CLASS[order.status]}`}>
                    {STATUS_LABELS[order.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Pager
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPage={setPage}
        busy={load.pending}
        label="Order list pages"
      />
    </div>
  );
}
