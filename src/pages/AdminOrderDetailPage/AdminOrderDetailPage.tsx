import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  adminGetOrder,
  adminConfirmOrder,
  adminShipOrder,
  adminDeliverOrder,
  adminCancelOrder,
  adminUpdateTracking,
} from "../../api/admin_order";
import type { AdminOrder } from "../../types/order_types";
import { getAdminAccount, type AdminAccount } from "../../api/admin_user";
import { ApiError } from "../../api/client";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { PageLoading, useLoadingState } from "../../components/LoadingSpinner";
import { formatCardDisplay } from "../../utils/card";
import { ShipModal } from "./ShipModal";
import styles from "./AdminOrderDetailPage.module.css";

/** Two decimals: this is the exact sum the customer's card will be charged. */
function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  awaiting_fulfillment: "Awaiting Fulfillment",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function CardBadge({ brand, last4 }: { brand: string; last4: string }) {
  if (!last4) return null;
  return (
    <span className={styles.cardChip}>
      {formatCardDisplay(brand, last4)}
    </span>
  );
}

export function AdminOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useLoadingState(loading);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmConfirm, setConfirmConfirm] = useState(false);
  const [shipModalOpen, setShipModalOpen] = useState(false);
  const [editingTracking, setEditingTracking] = useState(false);
  const [trackingDraft, setTrackingDraft] = useState("");
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const trackingInputRef = useRef<HTMLInputElement>(null);

  /*
   * "missing" and "unavailable" are deliberately different states. An account
   * deleted from the pool is a normal thing for an order to outlive; Cognito
   * being unreachable is not, and collapsing the two would make every customer
   * look deleted the moment the lookup failed.
   */
  const [account, setAccount] =
    useState<AdminAccount | "loading" | "missing" | "unavailable">("loading");

  useEffect(() => {
    if (!orderId) return;
    adminGetOrder(orderId)
      .then(setOrder)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => {
    if (!order?.user_id) return;
    let active = true;

    getAdminAccount(order.user_id)
      .then((found) => active && setAccount(found))
      .catch((e) => {
        if (!active) return;
        // Never surfaced through `error`: failing to name the customer must not
        // look like failing to load the order, which is the banner that would
        // otherwise appear above the fulfilment controls.
        setAccount(e instanceof ApiError && e.status === 404 ? "missing" : "unavailable");
      });

    return () => { active = false; };
  }, [order?.user_id]);

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

  const startEditTracking = () => {
    setTrackingDraft(order?.tracking_number ?? "");
    setTrackingError(null);
    setEditingTracking(true);
    setTimeout(() => trackingInputRef.current?.focus(), 30);
  };

  const saveTracking = async () => {
    if (!order) return;
    setTrackingLoading(true);
    setTrackingError(null);
    try {
      const updated = await adminUpdateTracking(order.id, trackingDraft.trim());
      setOrder(updated);
      setEditingTracking(false);
    } catch (e) {
      setTrackingError(e instanceof Error ? e.message : "Failed to save tracking.");
    } finally {
      setTrackingLoading(false);
    }
  };

  const cancelEditTracking = () => {
    setEditingTracking(false);
    setTrackingError(null);
  };

  if (load.pending) return <PageLoading visible={load.visible} />;
  if (!order) return <div className={styles.page}><p>Order not found.</p></div>;

  const canConfirm = order.status === "awaiting_fulfillment";
  const canShip = order.status === "confirmed";
  const canDeliver = order.status === "shipped";
  const canCancel = order.status !== "cancelled";
  /*
   * From the fact, not the status.
   *
   * This read `shipped || delivered`, which was the right boundary while
   * capture happened at ship. Once it moved to confirm, a confirmed order was
   * charged - and this still offered "Cancel Order" above the words "No charge
   * has been made", then issued a real refund.
   *
   * It decides the button label and which copy to show, and it is right about
   * the ordinary cases. It is not the same question the backend asks:
   * release_funds attempts the void and refunds if Stripe says the money moved,
   * so a captured-but-unrecorded order takes the refund path while this reads
   * false. That is why the non-refund copy hedges rather than promising.
   */
  /*
   * The fact when we have it, the old rule when we do not.
   *
   * captured_at is optional because a frontend can ship ahead of its backend,
   * and `!= null` treated that absence as "not charged" - which put "No charge
   * has been made" back over a delivered order while the old backend refunded
   * it. Undefined means the backend predates the field, and that backend still
   * branches on status, so mirror it.
   */
  const cancelNeedsRefund =
    order.captured_at != null
      ? true
      // Both absent *and* null fall back to the old rule. Only `undefined` did,
      // which left a legacy shipped row - served as null by a new backend, since
      // the migration leaves every pre-existing row NULL - reading "No charge
      // has been made" over an order the customer was charged for. The backend
      // asks Stripe for those; the console cannot, so it uses the status the
      // old backend used.
      : order.status === "shipped" || order.status === "delivered";

  /*
   * The recorded subtotal, not a fresh sum over the lines.
   *
   * create_order writes total_amount as exactly sum(unit_price x quantity), so
   * the two agree on every real order - but only one of them is what the card
   * was authorised for. Re-deriving it means the screen stops matching the
   * charge the moment anything makes the lines an incomplete account of the
   * order: a truncated items list, a discount, a manual adjustment. The
   * confirm dialog quotes this same figure, so the number in the dialog and the
   * number in the summary above it cannot disagree.
   */
  const subtotal = order.total_amount;
  const tax = order.tax_amount;
  const shipping = order.shipping_amount ?? 0;
  const total = subtotal + shipping + tax;

  return (
    <div className={styles.page}>
      <Link to="/admin/orders">← Back to Orders</Link>
      <h1>Order #{order.order_number}</h1>

      {/* Customer + payment meta */}
      <div className={styles.card}>
        <h3>Customer</h3>
        <div className={styles.metaGrid}>
          <div>
            <div className={styles.metaLabel}>Order mail</div>
            <div className={styles.metaValue}>
              {order.customer_email || (
                <span style={{ color: "#9ca3af" }}>—</span>
              )}
            </div>
          </div>
          {/*
            The account, resolved from the Cognito sub.
            
            Order mail is where the customer asked confirmations to go, which
            need not be their own address - a lab ordering against a shared
            purchasing address is the ordinary case. So that column no longer
            says who placed the order, and user_id on its own is a uuid.
          */}
          <div>
            <div className={styles.metaLabel}>Account</div>
            <div className={styles.metaValue}>
              {account === "loading" && (
                <span style={{ color: "#9ca3af" }}>Looking up…</span>
              )}
              {account === "missing" && (
                <span style={{ color: "#9ca3af" }} title={order.user_id}>
                  Deleted account
                </span>
              )}
              {account === "unavailable" && (
                <span style={{ color: "#9ca3af" }} title={order.user_id}>
                  Could not reach Cognito
                </span>
              )}
              {typeof account === "object" && account !== null && (
                <span title={order.user_id}>
                  {account.email || account.username}
                  {account.name && (
                    <span style={{ color: "#6b7280" }}> · {account.name}</span>
                  )}
                  {!account.enabled && (
                    <span style={{ color: "#b91c1c" }}> · disabled</span>
                  )}
                </span>
              )}
            </div>
          </div>
          <div>
            <div className={styles.metaLabel}>Status</div>
            <div className={styles.metaValue}>{STATUS_LABELS[order.status] ?? order.status}</div>
          </div>
          {/*
            Checkout only authorises; the money is captured when the order is
            confirmed. Stripe releases an uncaptured hold after about a week, so
            an order left unconfirmed that long can no longer be charged.

            The capture used to happen at ship, which put this deadline on the
            slowest step - packing and courier pickup can outrun a week, and the
            failure landed with the box already packed.
          */}
          {/*
            `!= null`, not `!== null`: the loose form also excludes undefined,
            which is what a frontend deployed ahead of its backend receives. The
            strict form let it through to Math.floor and rendered "Expires in
            NaNd" - the exact version-skew case the ErrorBoundary was added for.
          */}
          {order.authorization_days_remaining != null && (
            <div>
              <div className={styles.metaLabel}>Card hold</div>
              <div className={styles.metaValue}>
                {order.authorization_days_remaining <= 0 ? (
                  <span style={{ color: "#b91c1c", fontWeight: 600 }}>
                    Expired — capture will fail
                  </span>
                ) : (
                  <span
                    style={
                      order.authorization_days_remaining <= 2
                        ? { color: "#b45309", fontWeight: 600 }
                        : undefined
                    }
                  >
                    {/* ceil, not floor: floor collapsed the whole final day to
                        "0d", which reads as already expired - the one state the
                        branch above deliberately words differently. Anything
                        still live now reads at least "1d". */}
                    Expires in {Math.ceil(order.authorization_days_remaining)}d
                  </span>
                )}
              </div>
            </div>
          )}
          <div>
            <div className={styles.metaLabel}>Payment</div>
            <div className={styles.metaValue}>
              <CardBadge brand={order.card_brand} last4={order.card_last4} />
              {!order.card_last4 && <span style={{ color: "#9ca3af", fontSize: "0.8125rem" }}>—</span>}
            </div>
          </div>
          <div>
            <div className={styles.metaLabel}>Order Date</div>
            <div className={styles.metaValue}>
              {new Date(order.created_at).toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric",
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Items */}
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
              <span>${(item.unit_price * item.quantity).toFixed(2)}</span>
            </div>
          );
        })}
        <div style={{ marginTop: "0.5rem" }}>
          <div className={styles.totalRow}>
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          {/* Without this row the total stopped matching Subtotal + Tax, and
              the admin reconciling an order against Stripe would find a
              difference with nothing on the page explaining it. */}
          {shipping > 0 && (
            <div className={styles.totalRow}>
              <span>Shipping</span>
              <span>${shipping.toFixed(2)}</span>
            </div>
          )}
          {tax > 0 && (
            <div className={styles.totalRow}>
              <span>Tax</span>
              <span>${tax.toFixed(2)}</span>
            </div>
          )}
        </div>
        <div className={styles.total}>
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>

      {/* Shipping */}
      <div className={styles.card}>
        <h3>Shipping Address</h3>
        <p style={{ fontSize: "0.875rem" }}>
          {order.shipping_name} · {order.shipping_phone}<br />
          {order.shipping_address1}{order.shipping_address2 ? `, ${order.shipping_address2}` : ""}<br />
          {order.shipping_city}, {order.shipping_state} {order.shipping_zip}
        </p>
        {order.notes && <p style={{ fontSize: "0.875rem", color: "#6b7280" }}>Note: {order.notes}</p>}

        {(order.status === "shipped" || order.status === "delivered") && (
          <div className={styles.trackingRow}>
            <span className={styles.trackingLabel}>Tracking</span>
            {editingTracking ? (
              <div className={styles.trackingEdit}>
                <input
                  ref={trackingInputRef}
                  className={styles.trackingInput}
                  type="text"
                  value={trackingDraft}
                  placeholder="Enter tracking number"
                  // The visible "Tracking" text is a span, not a label, so it
                  // names nothing as far as a screen reader is concerned.
                  aria-label="Tracking number"
                  onChange={(e) => setTrackingDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void saveTracking();
                    if (e.key === "Escape") cancelEditTracking();
                  }}
                  disabled={trackingLoading}
                />
                <button
                  className={styles.trackingBtnSave}
                  onClick={() => void saveTracking()}
                  disabled={trackingLoading}
                >
                  {trackingLoading ? "Saving…" : "Save"}
                </button>
                <button
                  className={styles.trackingBtnCancel}
                  onClick={cancelEditTracking}
                  disabled={trackingLoading}
                >
                  Cancel
                </button>
                {trackingError && <span className={styles.trackingErr}>{trackingError}</span>}
              </div>
            ) : (
              <div className={styles.trackingDisplay}>
                <span className={styles.trackingValue}>
                  {order.tracking_number || <span className={styles.trackingNone}>Not set</span>}
                </span>
                <button className={styles.trackingBtnEdit} onClick={startEditTracking}>
                  {order.tracking_number ? "Edit" : "Add"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {(canConfirm || canShip || canDeliver || canCancel) && (
        <div className={styles.card}>
          <h3>Actions</h3>
          {error && <p style={{ color: "#dc2626", marginBottom: "0.75rem" }}>{error}</p>}
          <div className={styles.actions}>
            {canConfirm && (
              <button
                className={styles.btnShip}
                disabled={actionLoading}
                onClick={() => setConfirmConfirm(true)}
              >
                Confirm Order
              </button>
            )}
            {canShip && (
              <button
                className={styles.btnShip}
                disabled={actionLoading}
                onClick={() => setShipModalOpen(true)}
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
                {cancelNeedsRefund ? "Cancel + Refund" : "Cancel Order"}
              </button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmConfirm}
        title="Confirm and charge"
        /*
          Says what confirming actually does now that it captures the payment.
          The customer is charged at this click, not at dispatch - so this is a
          commitment to ship, and backing out afterwards is a refund on which
          Stripe keeps its fee rather than a free void. The old copy said
          "reserve stock", which was true and no longer the important part.
        */
        // `total`, the same figure the summary above renders - not a second
        // sum built from the same parts. They agree only because total_amount
        // happens to equal the item subtotal; add a discount to one and this
        // dialog would quote a different number from the summary directly above
        // it, on the one screen whose entire purpose is stating the exact
        // amount about to be charged.
        message={
          `This charges the customer ${formatMoney(total)} now, not when it ships. You are committing to send it — cancelling after this refunds the customer, and the payment fee is not returned.`
        }
        confirmLabel="Charge and confirm"
        onConfirm={() => {
          setConfirmConfirm(false);
          void handleAction(() => adminConfirmOrder(order.id));
        }}
        onCancel={() => setConfirmConfirm(false)}
      />

      <ShipModal
        isOpen={shipModalOpen}
        loading={actionLoading}
        alreadyCharged={order.captured_at != null}
        onConfirm={(trackingNumber) => {
          setShipModalOpen(false);
          void handleAction(() => adminShipOrder(order.id, trackingNumber || undefined));
        }}
        onCancel={() => setShipModalOpen(false)}
      />

      <ConfirmDialog
        isOpen={confirmCancel}
        title="Cancel Order"
        message={
          cancelNeedsRefund
            ? "Are you sure you want to cancel this order and issue a refund? This action cannot be undone."
            : // Hedged, not asserted - the same wording the customer's own cancel
              // dialog now carries, for the same reason. release_funds does not
              // branch on captured_at alone: it attempts the void and refunds
              // if Stripe says the money already moved. That happens when a
              // confirm captured and its commit rolled back, which leaves this
              // order reading awaiting_fulfillment with captured_at NULL - so
              // the flat claim was made on exactly the click that refunds.
              "Are you sure you want to cancel this order? If the card has already been charged we will refund it; otherwise the hold is released and nothing is charged."
        }
        confirmLabel={cancelNeedsRefund ? "Cancel + Refund" : "Cancel Order"}
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
