import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminListOrders } from "../../api/admin_order";
import type { AdminOrder, OrderStatus } from "../../types/order_types";
import styles from "./AdminOrdersPage.module.css";

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
  const [result, setResult] = useState<{
    tab: string | null;
    orders: AdminOrder[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    let ignore = false;
    adminListOrders(activeTab ?? undefined)
      .then((orders) => {
        if (!ignore) setResult({ tab: activeTab, orders, error: null });
      })
      .catch((e) => {
        if (!ignore) {
          setResult({
            tab: activeTab,
            orders: [],
            error: e instanceof Error ? e.message : "Failed to load orders.",
          });
        }
      });
    return () => {
      ignore = true;
    };
  }, [activeTab]);

  const isCurrent = result !== null && result.tab === activeTab;
  const loading = !isCurrent;
  const orders = isCurrent ? result.orders : EMPTY_ORDERS;
  const error = isCurrent ? result.error : null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => {
      if (o.order_number.toLowerCase().includes(q)) return true;
      if (o.customer_email.toLowerCase().includes(q)) return true;
      if (o.shipping_name.toLowerCase().includes(q)) return true;
      if (o.user_id.toLowerCase().includes(q)) return true;
      if (o.id.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [orders, search]);

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

      {loading ? (
        <p>Loading...</p>
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
                <td>{order.order_number}</td>
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
    </div>
  );
}
