import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getMyOrder, cancelMyOrder } from "../../api/order";
import { formatCardDisplay } from "../../utils/card";
import type { Order, OrderStatus } from "../../types/order_types";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import styles from "./OrderDetailPage.module.css";

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const STEPS = ["Pending", "Processing", "Shipped", "Delivered"];

function statusToStep(status: string): number {
  switch (status) {
    case "pending": return 0;
    case "awaiting_fulfillment":
    case "confirmed": return 1;
    case "shipped": return 2;
    case "delivered": return 3;
    default: return -1; // cancelled
  }
}

function StatusTracker({ status }: { status: string }) {
  if (status === "cancelled") {
    return (
      <div className={styles.cancelledBadge}>Cancelled</div>
    );
  }

  const current = statusToStep(status);

  return (
    <div className={styles.tracker}>
      {STEPS.map((label, i) => (
        <div key={label} className={styles.trackerStep}>
          <div className={styles.trackerRow}>
            <div
              className={`${styles.trackerDot} ${
                i < current
                  ? styles.dotDone
                  : i === current
                  ? styles.dotActive
                  : styles.dotPending
              }`}
            >
              {i < current ? "✓" : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`${styles.trackerLine} ${i < current ? styles.lineDone : ""}`} />
            )}
          </div>
          <span
            className={`${styles.trackerLabel} ${
              i === current ? styles.labelActive : ""
            }`}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    if (!orderId) { setLoading(false); return; }
    getMyOrder(orderId)
      .then(setOrder)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [orderId]);

  const handleCancel = async () => {
    if (!orderId) return;
    setCancelLoading(true);
    setError(null);
    try {
      const updated = await cancelMyOrder(orderId);
      setOrder(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed.");
    } finally {
      setCancelLoading(false);
    }
  };

  if (loading) return <div className={styles.page}><p>Loading...</p></div>;
  if (error && !order) return <div className={styles.page}><p>Error: {error}</p></div>;
  if (!order) return <div className={styles.page}><p>Order not found.</p></div>;

  const canCancel = order.status === "pending" || order.status === "awaiting_fulfillment";

  return (
    <div className={styles.page}>
      <Link to="/orders" className={styles.back}>← Back to Orders</Link>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.heading}>Order {order.order_number}</h1>
          <span className={styles.orderDate}>Placed {formatDate(order.created_at)}</span>
        </div>
        <span className={`${styles.badge} ${STATUS_BADGE[order.status]}`}>
          {STATUS_LABELS[order.status]}
        </span>
      </div>

      <div className={styles.card}>
        <h3>Order Status</h3>
        <StatusTracker status={order.status} />
      </div>

      <div className={styles.card}>
        <h3>Items</h3>
        {order.items.map((item) => (
          <div key={item.id} className={styles.itemRow}>
            <span>{item.product_name} — {item.variant_label} × {item.quantity}</span>
            <span>${(item.unit_price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
        <div className={styles.itemRow} style={{ color: "#6b7280" }}>
          <span>Subtotal</span>
          <span>${order.total_amount.toFixed(2)}</span>
        </div>
        {order.tax_amount > 0 && (
          <div className={styles.itemRow} style={{ color: "#6b7280" }}>
            <span>Tax ({parseFloat(((order.tax_amount / order.total_amount) * 100).toFixed(2))}%)</span>
            <span>${order.tax_amount.toFixed(2)}</span>
          </div>
        )}
        <div className={styles.total}>
          <span>Total</span>
          <span>${(order.total_amount + order.tax_amount).toFixed(2)}</span>
        </div>
      </div>

      <div className={styles.card}>
        <h3>Shipping Address</h3>
        <p className={styles.shippingText}>
          {order.shipping_name} · {order.shipping_phone}<br />
          {order.shipping_address1}{order.shipping_address2 ? `, ${order.shipping_address2}` : ""}<br />
          {order.shipping_city}, {order.shipping_state} {order.shipping_zip}
        </p>
        {order.notes && <p className={styles.notes}>Note: {order.notes}</p>}
      </div>

      {order.tracking_number && (
        <div className={styles.card}>
          <h3>Tracking</h3>
          <p className={styles.shippingText}>{order.tracking_number}</p>
        </div>
      )}

      {order.card_last4 && (
        <div className={styles.card}>
          <h3>Payment</h3>
          <p className={styles.shippingText}>
            {formatCardDisplay(order.card_brand, order.card_last4)}
          </p>
        </div>
      )}

      {canCancel && (
        <div className={styles.card}>
          <h3>Actions</h3>
          {error && <p className={styles.errorText}>{error}</p>}
          <div className={styles.actions}>
            <button
              className={styles.btnCancel}
              disabled={cancelLoading}
              onClick={() => setConfirmCancel(true)}
            >
              Cancel Order
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmCancel}
        title="Cancel Order"
        message="Are you sure you want to cancel this order? No charge has been made."
        confirmLabel="Cancel Order"
        variant="danger"
        onConfirm={() => {
          setConfirmCancel(false);
          void handleCancel();
        }}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  );
}
