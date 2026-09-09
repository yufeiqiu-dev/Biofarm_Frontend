import { US_STATES } from "./checkoutForms";
import type { ShippingForm } from "./checkoutForms";
import styles from "./CheckoutPage.module.css";

export function ShippingStep({
  shipping,
  onChange,
  onBack,
  onNext,
}: {
  shipping: ShippingForm;
  onChange: (v: ShippingForm) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const valid =
    !!shipping.address1.trim() &&
    !!shipping.city.trim() &&
    !!shipping.state &&
    !!shipping.zip.trim();

  return (
    <div className={styles.card}>
      <h2>Shipping Address</h2>
      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="checkout-address-line-1">Address Line 1 *</label>
        <input
          id="checkout-address-line-1"
          className={styles.input}
          value={shipping.address1}
          onChange={(e) => onChange({ ...shipping, address1: e.target.value })}
          placeholder="123 Main St"
        />
      </div>
      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="checkout-address-line-2">Address Line 2</label>
        <input
          id="checkout-address-line-2"
          className={styles.input}
          value={shipping.address2}
          onChange={(e) => onChange({ ...shipping, address2: e.target.value })}
          placeholder="Apt 4B"
        />
      </div>
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="checkout-city">City *</label>
          <input
            id="checkout-city"
            className={styles.input}
            value={shipping.city}
            onChange={(e) => onChange({ ...shipping, city: e.target.value })}
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="checkout-state">State *</label>
          <select
            id="checkout-state"
            className={styles.select}
            value={shipping.state}
            onChange={(e) => onChange({ ...shipping, state: e.target.value })}
          >
            <option value="">Select state</option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="checkout-zip-code">ZIP Code *</label>
        <input
          id="checkout-zip-code"
          className={styles.input}
          value={shipping.zip}
          onChange={(e) => onChange({ ...shipping, zip: e.target.value })}
          placeholder="62701"
        />
      </div>
      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="checkout-order-notes">Order Notes</label>
        <textarea
          id="checkout-order-notes"
          className={styles.textarea}
          value={shipping.notes}
          onChange={(e) => onChange({ ...shipping, notes: e.target.value })}
          placeholder="Delivery instructions..."
        />
      </div>
      <div className={styles.actions}>
        <button className={styles.btnSecondary} onClick={onBack}>
          ← Back
        </button>
        <button
          className={styles.btnPrimary}
          onClick={onNext}
          disabled={!valid}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
