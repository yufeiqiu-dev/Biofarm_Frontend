import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getMyOrders } from "../../api/order";
import type { Order, OrderStatus } from "../../types/order_types";
import styles from "./OrdersPage.module.css";

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  awaiting_fulfillment: "Processing",
  confirmed: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_BADGE: Record<OrderStatus, string> = {
  pending: styles.badgePending,
  awaiting_fulfillment: styles.badgeProcessing,
  confirmed: styles.badgeProcessing,
  shipped: styles.badgeShipped,
  delivered: styles.badgeDelivered,
  cancelled: styles.badgeCancelled,
};

const FILTER_TABS: { label: string; value: OrderStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Processing", value: "awaiting_fulfillment" },
  { label: "Shipped", value: "shipped" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function itemSummary(order: Order) {
  return order.items
    .map((i) => `${i.product_name} × ${i.quantity}`)
    .join(", ");
}

function matchesSearch(order: Order, query: string): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  if (order.order_number.toLowerCase().includes(q)) return true;
  return order.items.some((i) => i.product_name.toLowerCase().includes(q));
}

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");

  useEffect(() => {
    getMyOrders()
      .then(setOrders)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "all") {
        // "processing" tab matches both awaiting_fulfillment and confirmed
        if (statusFilter === "awaiting_fulfillment") {
          if (o.status !== "awaiting_fulfillment" && o.status !== "confirmed") return false;
        } else if (o.status !== statusFilter) {
          return false;
        }
      }
      return matchesSearch(o, search);
    });
  }, [orders, statusFilter, search]);

  if (loading) return <div className={styles.page}><p>Loading orders...</p></div>;
  if (error) return <div className={styles.page}><p>Error: {error}</p></div>;

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>My Orders</h1>

      {orders.length > 0 && (
        <div className={styles.controls}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search by order # or product name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className={styles.filterTabs}>
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                className={`${styles.filterTab} ${statusFilter === tab.value ? styles.filterTabActive : ""}`}
                onClick={() => setStatusFilter(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {orders.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📦</div>
          <p>You haven't placed any orders yet.</p>
          <Link to="/products" className={styles.shopLink}>Shop Now</Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🔍</div>
          <p>No orders match your search.</p>
          <button
            className={styles.clearBtn}
            onClick={() => { setSearch(""); setStatusFilter("all"); }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        filtered.map((order) => (
          <Link
            key={order.id}
            to={`/orders/${order.id}`}
            className={styles.orderCard}
          >
            <div className={styles.cardTop}>
              <div className={styles.orderMeta}>
                <span className={styles.orderNumber}>Order {order.order_number}</span>
                <span className={styles.orderDate}>{formatDate(order.created_at)}</span>
              </div>
              <span className={`${styles.badge} ${STATUS_BADGE[order.status]}`}>
                {STATUS_LABELS[order.status]}
              </span>
            </div>

            <div className={styles.cardBottom}>
              <span className={styles.itemSummary}>{itemSummary(order)}</span>
              <div className={styles.totalRow}>
                <span className={styles.total}>${(order.total_amount + order.tax_amount).toFixed(2)}</span>
                <span className={styles.arrow}>›</span>
              </div>
            </div>
          </Link>
        ))
      )}
    </div>
  );
}
