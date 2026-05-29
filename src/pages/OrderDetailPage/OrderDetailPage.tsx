import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getMyOrder, cancelMyOrder } from "../../api/order";
import type { Order } from "../../types/order_types";
import styles from "./OrderDetailPage.module.css";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  awaiting_fulfillment: "Awaiting Fulfillment",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    if (!orderId) { setLoading(false); return; }
    getMyOrder(orderId)
      .then(setOrder)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [orderId]);

  const handleCancel = async () => {
    if (!orderId || !window.confirm("Cancel this order? No charge will be made.")) return;
    setCancelLoading(true);
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
  if (error || !order) return <div className={styles.page}><p>Error: {error ?? "Not found"}</p></div>;

  return (
    <div className={styles.page}>
      <Link to="/orders">← Back to Orders</Link>
      <h1>Order #{order.order_number}</h1>
      <p>Status: <strong>{STATUS_LABELS[order.status] ?? order.status}</strong></p>

      <div className={styles.card}>
        <h3>Items</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f3f4f6", textAlign: "left" }}>
              <th style={{ padding: "0.5rem" }}>Product</th>
              <th style={{ padding: "0.5rem" }}>Variant</th>
              <th style={{ padding: "0.5rem" }}>Qty</th>
              <th style={{ padding: "0.5rem" }}>Unit Price</th>
              <th style={{ padding: "0.5rem", textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "0.5rem" }}>{item.product_name}</td>
                <td style={{ padding: "0.5rem" }}>{item.variant_label}</td>
                <td style={{ padding: "0.5rem" }}>{item.quantity}</td>
                <td style={{ padding: "0.5rem" }}>${Number(item.unit_price).toFixed(2)}</td>
                <td style={{ padding: "0.5rem", textAlign: "right" }}>${(Number(item.unit_price) * item.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className={styles.total}>
          <span>Total</span>
          <span>${Number(order.total_amount).toFixed(2)}</span>
        </div>
      </div>

      <div className={styles.card}>
        <h3>Shipping Address</h3>
        <p style={{ fontSize: "0.875rem" }}>
          {order.shipping_name}<br />
          {order.shipping_address1}{order.shipping_address2 ? `, ${order.shipping_address2}` : ""}<br />
          {order.shipping_city}, {order.shipping_state} {order.shipping_zip}
        </p>
        {order.notes && <p style={{ fontSize: "0.875rem", color: "#6b7280" }}>Note: {order.notes}</p>}
      </div>

      {order.status === "awaiting_fulfillment" && (
        <div>
          {error && <p style={{ color: "#dc2626", marginBottom: "0.5rem" }}>{error}</p>}
          <button
            onClick={handleCancel}
            disabled={cancelLoading}
            style={{
              padding: "0.5rem 1rem",
              background: "#fee2e2",
              color: "#991b1b",
              border: "1px solid #fca5a5",
              borderRadius: "0.375rem",
              cursor: "pointer",
            }}
          >
            {cancelLoading ? "Cancelling..." : "Cancel Order"}
          </button>
        </div>
      )}
    </div>
  );
}
