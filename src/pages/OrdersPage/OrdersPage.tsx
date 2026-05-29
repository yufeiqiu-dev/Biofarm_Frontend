import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMyOrders } from "../../api/order";
import type { Order } from "../../types/order_types";
import shared from "../../styles/shared.module.css";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  awaiting_fulfillment: "Awaiting Fulfillment",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function OrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyOrders()
      .then(setOrders)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={shared.page}><p>Loading orders...</p></div>;
  if (error) return <div className={shared.page}><p>Error: {error}</p></div>;

  return (
    <div className={shared.page}>
      <h1>My Orders</h1>
      {orders.length === 0 ? (
        <p>No orders yet. <Link to="/products">Start shopping</Link></p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f3f4f6", textAlign: "left" }}>
              <th style={{ padding: "0.75rem" }}>Order #</th>
              <th style={{ padding: "0.75rem" }}>Date</th>
              <th style={{ padding: "0.75rem" }}>Items</th>
              <th style={{ padding: "0.75rem" }}>Total</th>
              <th style={{ padding: "0.75rem" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                key={order.id}
                style={{ borderBottom: "1px solid #e5e7eb", cursor: "pointer" }}
                onClick={() => navigate(`/orders/${order.id}`)}
              >
                <td style={{ padding: "0.75rem" }}>
                  #{order.order_number}
                </td>
                <td style={{ padding: "0.75rem" }}>
                  {new Date(order.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: "0.75rem" }}>{order.items.length}</td>
                <td style={{ padding: "0.75rem" }}>${Number(order.total_amount).toFixed(2)}</td>
                <td style={{ padding: "0.75rem" }}>
                  <span>{STATUS_LABELS[order.status] ?? order.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
