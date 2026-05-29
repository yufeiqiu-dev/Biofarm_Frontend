import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getMyOrder } from "../../api/order";
import type { Order } from "../../types/order_types";
import styles from "./OrderDetailPage.module.css";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  awaiting_fulfillment: "Awaiting Fulfillment",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    getMyOrder(orderId)
      .then(setOrder)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) return <div className={styles.page}><p>Loading...</p></div>;
  if (error || !order) return <div className={styles.page}><p>Error: {error ?? "Not found"}</p></div>;

  return (
    <div className={styles.page}>
      <Link to="/orders">← Back to Orders</Link>
      <h1>Order #{order.order_number}</h1>
      <p>Status: <strong>{STATUS_LABELS[order.status] ?? order.status}</strong></p>

      <div className={styles.card}>
        <h3>Items</h3>
        {order.items.map((item) => (
          <div key={item.id} className={styles.row}>
            <span>{item.product_name} — {item.variant_label} × {item.quantity}</span>
            <span>${(Number(item.unit_price) * item.quantity).toFixed(2)}</span>
          </div>
        ))}
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
    </div>
  );
}
