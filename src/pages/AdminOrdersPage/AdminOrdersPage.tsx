import { useEffect, useState } from "react";
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
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    adminListOrders(activeTab ?? undefined)
      .then(setOrders)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load orders."))
      .finally(() => setLoading(false));
  }, [activeTab]);

  return (
    <div className={styles.page}>
      <h1>Orders</h1>
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
      ) : orders.length === 0 ? (
        <p>No orders found.</p>
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
            {orders.map((order) => (
              <tr key={order.id} onClick={() => navigate(`/admin/orders/${order.id}`)}>
                <td>#{order.order_number}</td>
                <td style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                  {order.user_id.substring(0, 12)}…
                </td>
                <td>{new Date(order.created_at).toLocaleDateString()}</td>
                <td>{order.items.length}</td>
                <td>${Number(order.total_amount).toFixed(2)}</td>
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
