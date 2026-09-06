import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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

const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  pending: styles.badgePending,
  awaiting_fulfillment: styles.badgeAwaiting,
  confirmed: styles.badgeConfirmed,
  shipped: styles.badgeShipped,
  delivered: styles.badgeDelivered,
  cancelled: styles.badgeCancelled,
};

// Module-level so the memo below is not handed a new array on the renders
// where no result for the active tab has arrived yet.
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
  const [activeTab, setActiveTab] = useState<string | null>("awaiting_fulfillment");
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
  const [askedFor, setAskedFor] = useState({ tab: activeTab, query });
  if (askedFor.tab !== activeTab || askedFor.query !== query) {
    setAskedFor({ tab: activeTab, query });
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

  const requestKey = `${activeTab ?? "all"}|${query}|${offset}`;

  useEffect(() => {
    let ignore = false;
    adminListOrders({
      status: activeTab ?? undefined,
      q: query || undefined,
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
  }, [activeTab, query, offset, requestKey]);

  const isCurrent = result !== null && result.key === requestKey;
  const loading = !isCurrent;
  const load = useLoadingState(loading);
  const filtered = isCurrent ? result.orders : EMPTY_ORDERS;
  const total = isCurrent ? result.total : 0;
  const error = isCurrent ? result.error : null;


  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1>Orders</h1>
        <input
          className={styles.searchInput}
          type="search"
          placeholder="Search by order #, email, or customer ID…"
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

      {error && <p style={{ color: "#dc2626" }}>Error: {error}</p>}

      {load.pending ? (
        <PageLoading compact visible={load.visible} />
      ) : filtered.length === 0 ? (
        <p>{search ? "No orders match your search." : "No orders found."}</p>
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
                <td>${(order.total_amount + order.tax_amount).toFixed(2)}</td>
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
