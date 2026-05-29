import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
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
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { formatCardDisplay } from "../../utils/card";
import styles from "./AdminOrderDetailPage.module.css";

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

interface ShipModalProps {
  isOpen: boolean;
  loading: boolean;
  onConfirm: (trackingNumber: string) => void;
  onCancel: () => void;
}

function ShipModal({ isOpen, loading, onConfirm, onCancel }: ShipModalProps) {
  const [tracking, setTracking] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTracking("");
    setTimeout(() => inputRef.current?.focus(), 50);
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className={styles.modalBackdrop} onClick={onCancel}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ship-modal-title"
      >
        <h2 id="ship-modal-title" className={styles.modalTitle}>Mark as Shipped</h2>
        <p className={styles.modalDesc}>
          Enter a tracking number so the customer can follow their shipment. This will capture payment.
        </p>
        <label className={styles.modalLabel} htmlFor="tracking-input">
          Tracking Number <span className={styles.modalOptional}>(optional)</span>
        </label>
        <input
          id="tracking-input"
          ref={inputRef}
          className={styles.modalInput}
          type="text"
          placeholder="e.g. 1Z999AA10123456784"
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onConfirm(tracking.trim()); }}
        />
        <div className={styles.modalButtons}>
          <button className={styles.modalCancel} onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            className={styles.modalConfirm}
            onClick={() => onConfirm(tracking.trim())}
            disabled={loading}
          >
            {loading ? "Shipping…" : "Mark Shipped"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function AdminOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [loading, setLoading] = useState(true);
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

  if (loading) return <div className={styles.page}><p>Loading...</p></div>;
  if (!order) return <div className={styles.page}><p>Order not found.</p></div>;

  const canConfirm = order.status === "awaiting_fulfillment";
  const canShip = order.status === "confirmed";
  const canDeliver = order.status === "shipped";
  const canCancel = order.status !== "cancelled";
  const cancelNeedsRefund = order.status === "shipped" || order.status === "delivered";

  const subtotal = order.items.reduce((s, i) => s + Number(i.unit_price) * i.quantity, 0);
  const tax = Number(order.tax_amount);
  const total = subtotal + tax;

  return (
    <div className={styles.page}>
      <Link to="/admin/orders">← Back to Orders</Link>
      <h1>Order #{order.order_number}</h1>

      {/* Customer + payment meta */}
      <div className={styles.card}>
        <h3>Customer</h3>
        <div className={styles.metaGrid}>
          <div>
            <div className={styles.metaLabel}>Email</div>
            <div className={styles.metaValue}>
              {order.customer_email || (
                <code style={{ fontSize: "0.75rem", color: "#9ca3af" }}>{order.user_id}</code>
              )}
            </div>
          </div>
          <div>
            <div className={styles.metaLabel}>Status</div>
            <div className={styles.metaValue}>{STATUS_LABELS[order.status] ?? order.status}</div>
          </div>
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
              <span>${(Number(item.unit_price) * item.quantity).toFixed(2)}</span>
            </div>
          );
        })}
        <div style={{ marginTop: "0.5rem" }}>
          <div className={styles.totalRow}>
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
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
        title="Confirm Order"
        message="Confirm this order and reserve stock? The customer will be notified that their order is being prepared."
        confirmLabel="Confirm Order"
        onConfirm={() => {
          setConfirmConfirm(false);
          void handleAction(() => adminConfirmOrder(order.id));
        }}
        onCancel={() => setConfirmConfirm(false)}
      />

      <ShipModal
        isOpen={shipModalOpen}
        loading={actionLoading}
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
            : "Are you sure you want to cancel this order? No charge has been made."
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
