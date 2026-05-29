import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  adminGetOrder,
  adminShipOrder,
  adminDeliverOrder,
  adminCancelOrder,
} from "../../api/admin_order";
import type { AdminOrder } from "../../types/order_types";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import styles from "./AdminOrderDetailPage.module.css";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  awaiting_fulfillment: "Awaiting Fulfillment",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function AdminOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    adminGetOrder(orderId)
      .then(setOrder)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [orderId]);

  const handleAction = async (action: () => Promise<AdminOrder>) => {
    setActionLoading(true);
    setError(null);
    try {
      const updated = await action();
      setOrder(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className={styles.page}><p>Loading...</p></div>;
  if (!order) return <div className={styles.page}><p>Order not found.</p></div>;

  const canShip = order.status === "awaiting_fulfillment";
  const canDeliver = order.status === "shipped";
  const canCancel = !["delivered", "cancelled"].includes(order.status);

  return (
    <div className={styles.page}>
      <Link to="/admin/orders">← Back to Orders</Link>
      <h1>Order #{order.order_number}</h1>
      <p>
        Status: <strong>{STATUS_LABELS[order.status] ?? order.status}</strong>
        {" · "}Customer: <code style={{ fontSize: "0.8rem" }}>{order.user_id}</code>
      </p>

      <div className={styles.card}>
        <h3>Items</h3>
        {order.items.map((item) => {
          const hasStockWarning =
            item.current_stock !== null && item.current_stock < item.quantity;
          return (
            <div key={item.id} className={styles.itemRow}>
              <span>
                {item.product_name} — {item.variant_label} × {item.quantity}
                {hasStockWarning && (
                  <span className={styles.stockWarning}>
                    ⚠ {item.current_stock} in stock
                  </span>
                )}
              </span>
              <span>${(Number(item.unit_price) * item.quantity).toFixed(2)}</span>
            </div>
          );
        })}
        <div className={styles.total}>
          <span>Total</span>
          <span>${Number(order.total_amount).toFixed(2)}</span>
        </div>
      </div>

      <div className={styles.card}>
        <h3>Shipping Address</h3>
        <p style={{ fontSize: "0.875rem" }}>
          {order.shipping_name} · {order.shipping_phone}<br />
          {order.shipping_address1}{order.shipping_address2 ? `, ${order.shipping_address2}` : ""}<br />
          {order.shipping_city}, {order.shipping_state} {order.shipping_zip}
        </p>
        {order.notes && <p style={{ fontSize: "0.875rem", color: "#6b7280" }}>Note: {order.notes}</p>}
      </div>

      {(canShip || canDeliver || canCancel) && (
        <div className={styles.card}>
          <h3>Actions</h3>
          {error && <p style={{ color: "#dc2626", marginBottom: "0.75rem" }}>{error}</p>}
          <div className={styles.actions}>
            {canShip && (
              <button
                className={styles.btnShip}
                disabled={actionLoading}
                onClick={() => handleAction(() => adminShipOrder(order.id))}
              >
                Mark Shipped
              </button>
            )}
            {canDeliver && (
              <button
                className={styles.btnDeliver}
                disabled={actionLoading}
                onClick={() => handleAction(() => adminDeliverOrder(order.id))}
              >
                Mark Delivered
              </button>
            )}
            {canCancel && (
              <button
                className={styles.btnCancel}
                disabled={actionLoading}
                onClick={() => setConfirmCancel(true)}
              >
                Cancel + Refund
              </button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmCancel}
        title="Cancel Order"
        message="Are you sure you want to cancel this order and issue a refund? This action cannot be undone."
        confirmLabel="Cancel + Refund"
        variant="danger"
        onConfirm={() => {
          setConfirmCancel(false);
          void handleAction(() => adminCancelOrder(order.id));
        }}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  );
}
