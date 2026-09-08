import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCartSideBar } from "../../context/useCartSideBar";
import { useAuth } from "../../auth/useAuth";
import { getMyOrder, getMyOrderByPaymentIntent } from "../../api/order";
import { formatCardDisplay } from "../../utils/card";
import type { Order } from "../../types/order_types";
import { taxRatePercent } from "../../utils/tax";
import styles from "./OrderSuccessPage.module.css";

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 10000;

function fmt(cents: number) {
  return `$${cents.toFixed(2)}`;
}

export function OrderSuccessPage() {
  const [searchParams] = useSearchParams();
  const { clearCart } = useCartSideBar();
  const { loading: authLoading } = useAuth();
  const paymentIntent = searchParams.get("payment_intent");
  // Bypass mode creates the order inline and sends its id directly. Real Stripe
  // sends a PaymentIntent id and the order does not exist until the webhook
  // lands, which is what the polling below is for.
  const orderId = searchParams.get("order_id");
  const redirectStatus = searchParams.get("redirect_status");

  const [order, setOrder] = useState<Order | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const didClear = useRef(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("payment_intent_client_secret");
    window.history.replaceState({}, "", url.toString());
  }, []);

  /*
   * Cleared when the order is known to exist - not on arrival.
   *
   * Landing here is a Stripe redirect on redirect_status=succeeded, which means
   * the card was authorised and nothing more. If the item sold out while the
   * customer was paying, the webhook voids that authorisation and no order is
   * ever created; clearing on arrival threw away the cart of someone who had
   * bought nothing, leaving them no way to try again.
   *
   * Waiting for the order also keeps the older fix this replaces. Stripe
   * confirms with `redirect: "always"`, so this is a full page load: the cart
   * provider mounts fresh and Amplify restores the session asynchronously
   * afterwards. Clearing on mount ran while `user` was still null - and
   * clearCart only removes the saved copy when it knows whose cart it is, so it
   * emptied an already-empty in-memory cart, left storage alone, and the
   * provider loaded the paid-for cart straight back out of it a moment later.
   * By the time an order has been fetched the session is necessarily there,
   * because fetching it needed one.
   */
  useEffect(() => {
    if (!order) return;
    if (authLoading) return;
    if (didClear.current) return;

    didClear.current = true;
    clearCart();
  }, [order, authLoading, clearCart]);

  useEffect(() => {
    if (redirectStatus !== "succeeded") return;

    // Already created — fetch it once rather than polling for something that is
    // not going to appear later than now.
    if (orderId) {
      let active = true;
      getMyOrder(orderId)
        .then((o) => active && setOrder(o))
        .catch(() => active && setTimedOut(true));
      return () => { active = false; };
    }

    if (!paymentIntent) return;

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
  }, [paymentIntent, orderId, redirectStatus]);

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

  /*
   * No order, and we have stopped waiting. This used to fall through to the
   * layout below and render a green tick, "Order Placed!" and "Your payment was
   * successful" - to someone whose authorisation had in all likelihood just been
   * voided, while telling them to look in My Orders for something that would
   * never arrive.
   *
   * Both causes are covered honestly here because the page genuinely cannot
   * tell them apart: a slow webhook and a sold-out item look identical from the
   * browser.
   */
  if (!order && timedOut) {
    return (
      <div className={styles.failed}>
        <h1>We couldn&apos;t confirm your order</h1>
        <p>
          Your card was authorised, but we have not been able to confirm the
          order itself.
        </p>
        {/*
          Does not promise which way the money went.

          Sold out reaches the webhook from payment_intent.succeeded as well as
          the capturable event, so the intent may already hold real money by the
          time we release it - the void is attempted, refused, and a refund
          issued instead. Sold out also means no order is ever created, so the
          customer's polling times out and lands here: exactly the person being
          told they were not charged, sometimes right after they were.
        */}
        <p>
          Usually the confirmation is just running late and the order will appear
          in My Orders shortly. Occasionally an item sells out while a payment is
          going through — if that has happened we release the authorisation, and
          refund it if your card was already charged.
        </p>
        <p>
          Your cart has been kept either way, so you can order again if you need
          to.
        </p>
        <div className={styles.actions}>
          <Link to="/orders" className={styles.btnPrimary}>
            Check My Orders
          </Link>
          <Link to="/cart" className={styles.btnSecondary}>
            Return to Cart
          </Link>
        </div>
      </div>
    );
  }

  /*
   * The recorded subtotal, not a fresh sum over the lines - the same rule the
   * admin detail page follows.
   *
   * The grand total below comes from total_amount + shipping + tax, so
   * re-deriving this one meant the receipt's own arithmetic held only while
   * total_amount happened to equal the line sum. Anything that makes the lines
   * an incomplete account of the order - a discount, an adjustment, a truncated
   * items list - and Subtotal + Shipping + Tax stops adding up to Total, in one
   * visible block, on the screen a customer reads straight after paying.
   */
  const subtotal = order ? order.total_amount : null;
  const tax = order ? order.tax_amount : null;
  /*
   * Shipping included, and shown on its own row below.
   *
   * The card is charged tax_result.total_cents, which is goods + shipping + the
   * tax on both. Leaving the fee out of the receipt understated the charge on
   * the one screen a customer reads immediately after paying - the same dropped
   * shipping_amount the admin response had, on the other side of the till.
   */
  const shipping = order ? order.shipping_amount : null;
  const total = order ? order.total_amount + order.shipping_amount + order.tax_amount : null;
  // Goods + shipping is the taxed amount; see taxRatePercent for why.
  const taxPct =
    subtotal !== null && shipping !== null && tax !== null
      ? taxRatePercent(tax, subtotal + shipping)
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
            ? `Order #${order.order_number} · Placed ${placedDate}`
            : "Your payment was successful."}
        </p>
      </div>

      {/* Items card */}
      {order && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Order Summary</h2>
            <span className={styles.orderMeta}>#{order.order_number}</span>
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
            {shipping !== null && shipping > 0 && (
              <div className={styles.totalRow}>
                <span>Shipping</span>
                <span>{fmt(shipping)}</span>
              </div>
            )}
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
