import { useCartSideBar } from "../../context/useCartSideBar";
import type { ContactForm, ShippingForm } from "./checkoutForms";
import styles from "./CheckoutPage.module.css";

export function ReviewStep({
  contact,
  shipping,
  onBack,
  onNext,
  loading,
}: {
  contact: ContactForm;
  shipping: ShippingForm;
  onBack: () => void;
  onNext: () => void;
  loading: boolean;
}) {
  const { cartItems } = useCartSideBar();
  const subtotal = cartItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  return (
    <div className={styles.card}>
      <h2>Review Your Order</h2>
      <h3>Items</h3>
      {cartItems.map((item) => (
        <div key={item.id} className={styles.summaryRow}>
          <span>
            {item.name} — {item.sizeLabel} × {item.quantity}
          </span>
          <span>${(item.unitPrice * item.quantity).toFixed(2)}</span>
        </div>
      ))}
      <div className={styles.summaryRow} style={{ color: "#6b7280", marginTop: "0.5rem" }}>
        <span>Subtotal</span>
        <span>${subtotal.toFixed(2)}</span>
      </div>
      <div className={styles.summaryRow} style={{ color: "#6b7280" }}>
        <span>Tax</span>
        <span>Calculated at payment</span>
      </div>
      <div className={styles.summaryTotal}>
        <span>Estimated Total</span>
        <span>~${subtotal.toFixed(2)}+</span>
      </div>
      <h3 style={{ marginTop: "1.5rem" }}>Shipping To</h3>
      <p style={{ fontSize: "0.875rem", color: "#374151" }}>
        {contact.name}
        <br />
        {shipping.address1}
        {shipping.address2 ? `, ${shipping.address2}` : ""}
        <br />
        {shipping.city}, {shipping.state} {shipping.zip}
      </p>
      {shipping.notes && (
        <p style={{ fontSize: "0.875rem", color: "#6b7280" }}>
          Note: {shipping.notes}
        </p>
      )}
      <div className={styles.actions}>
        <button className={styles.btnSecondary} onClick={onBack} disabled={loading}>
          ← Back
        </button>
        <button className={styles.btnPrimary} onClick={onNext} disabled={loading}>
          {loading ? "Calculating tax…" : "Proceed to Payment →"}
        </button>
      </div>
    </div>
  );
}
