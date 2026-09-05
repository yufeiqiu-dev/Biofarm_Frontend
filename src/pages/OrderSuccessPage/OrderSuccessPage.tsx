import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCartSideBar } from "../../context/useCartSideBar";
import { getMyOrderByPaymentIntent } from "../../api/order";
import { formatCardDisplay } from "../../utils/card";
import type { Order } from "../../types/order_types";
import styles from "./OrderSuccessPage.module.css";

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 10000;

function fmt(cents: number) {
  return `$${cents.toFixed(2)}`;
}

export function OrderSuccessPage() {
  const [searchParams] = useSearchParams();
  const { clearCart } = useCartSideBar();
  const paymentIntent = searchParams.get("payment_intent");
  const redirectStatus = searchParams.get("redirect_status");

  const [order, setOrder] = useState<Order | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const didClear = useRef(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("payment_intent_client_secret");
    window.history.replaceState({}, "", url.toString());

    if (redirectStatus === "succeeded" && !didClear.current) {
      didClear.current = true;
      clearCart();
    }
  }, [redirectStatus, clearCart]);

  useEffect(() => {
    if (redirectStatus !== "succeeded" || !paymentIntent) return;

    let active = true;
    const startedAt = Date.now();

    async function poll() {
      if (!active) return;
      try {
        const o = await getMyOrderByPaymentIntent(paymentIntent!);
        if (active) setOrder(o);
      } catch {
        if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
          if (active) setTimedOut(true);
        } else {
          setTimeout(poll, POLL_INTERVAL_MS);
        }
      }
    }

    poll();
    return () => { active = false; };
  }, [paymentIntent, redirectStatus]);

  if (redirectStatus !== "succeeded") {
    return (
      <div className={styles.failed}>
        <h1>Payment not completed</h1>
        <p>Something went wrong. Please try again or contact support.</p>
        <Link to="/cart">Return to Cart</Link>
      </div>
    );
  }

  if (!order && !timedOut) {
    return <div className={styles.loading}>Confirming your order…</div>;
  }

  const subtotal = order
    ? order.items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
    : null;
  const tax = order ? order.tax_amount : null;
  const total = order ? order.total_amount + order.tax_amount : null;
  const taxPct =
    subtotal && tax && subtotal > 0
      ? parseFloat(((tax / subtotal) * 100).toFixed(2))
      : null;
  const placedDate = order
    ? new Date(order.created_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.checkmark}>✓</div>
        <h1 className={styles.title}>Order Placed!</h1>
        <p className={styles.subtitle}>
          {order
            ? `Order ${order.order_number} · Placed ${placedDate}`
            : "Your payment was successful."}
        </p>
      </div>

      {/* Items card */}
      {order && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Order Summary</h2>
            <span className={styles.orderMeta}>{order.order_number}</span>
          </div>

          {order.items.map((item) => (
            <div key={item.id} className={styles.itemRow}>
              <span>
                {item.product_name}{" "}
                <span style={{ color: "#9ca3af" }}>({item.variant_label})</span>
                {item.quantity > 1 && ` ×${item.quantity}`}
              </span>
              <span>{fmt(item.unit_price * item.quantity)}</span>
            </div>
          ))}

          <div className={styles.totalsSection}>
            <div className={styles.totalRow}>
              <span>Subtotal</span>
              <span>{fmt(subtotal!)}</span>
            </div>
            {tax !== null && tax > 0 && (
              <div className={styles.totalRow}>
                <span>Tax{taxPct !== null ? ` (${taxPct}%)` : ""}</span>
                <span>{fmt(tax)}</span>
              </div>
            )}
            <div className={styles.grandTotal}>
              <span>Total</span>
              <span>{fmt(total!)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Shipping card */}
      {order && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Shipping To</h2>
          </div>
          <p className={styles.shippingText}>
            {order.shipping_name}
            <br />
            {order.shipping_address1}
            {order.shipping_address2 && <>, {order.shipping_address2}</>}
            <br />
            {order.shipping_city}, {order.shipping_state} {order.shipping_zip}
            <br />
            {order.shipping_phone}
            {order.notes && (
              <>
                <br />
                <em>{order.notes}</em>
              </>
            )}
          </p>
        </div>
      )}

      {/* Payment card */}
      {order?.card_last4 && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Payment</h2>
          </div>
          <p className={styles.shippingText}>
            {formatCardDisplay(order.card_brand, order.card_last4)}
          </p>
        </div>
      )}

      {/* Fallback when order not found */}
      {timedOut && !order && (
        <p className={styles.fallback}>
          Your payment was received. Order details will appear in{" "}
          <Link to="/orders">My Orders</Link> shortly.
        </p>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        <Link to="/orders" className={styles.btnPrimary}>
          View My Orders
        </Link>
        <Link to="/products" className={styles.btnSecondary}>
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
