import { useState } from "react";
import {
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { taxRatePercent } from "../../utils/tax";
import styles from "./CheckoutPage.module.css";

export function PaymentForm({
  onBack,
  subtotalCents,
  taxAmountCents,
  shippingAmountCents,
}: {
  clientSecret: string;
  onBack: () => void;
  subtotalCents: number;
  taxAmountCents: number;
  shippingAmountCents: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Stripe.js has loaded but the card form has not mounted. Returning silently
  // here is what made a dead Pay button possible: the click did nothing, showed
  // nothing, and left the buyer pressing it again.
  const paymentFormReady = Boolean(stripe && elements);

  const handlePay = async () => {
    // Narrowed explicitly rather than through paymentFormReady, which is a
    // boolean and tells the compiler nothing about these two being non-null.
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success`,
      },
    });

    if (stripeError) {
      setError(stripeError.message ?? "Payment failed.");
      setLoading(false);
    }
  };

  const subtotal = subtotalCents / 100;
  const shipping = shippingAmountCents / 100;
  const tax = taxAmountCents / 100;
  const total = subtotal + shipping + tax;
  // Goods + shipping is the taxed amount; see taxRatePercent for why.
  const taxPct = taxRatePercent(taxAmountCents, subtotalCents + shippingAmountCents);

  return (
    <div className={styles.card}>
      <h2>Payment</h2>
      <PaymentElement />
      <div className={styles.summaryRow} style={{ marginTop: "1.25rem", color: "#6b7280" }}>
        <span>Subtotal</span>
        <span>${subtotal.toFixed(2)}</span>
      </div>
      {/* Shown before the card is charged, always. A shipping cost that only
          appears on the receipt is the reason people abandon carts. */}
      <div className={styles.summaryRow} style={{ color: "#6b7280" }}>
        <span>Shipping</span>
        <span>{shipping > 0 ? `$${shipping.toFixed(2)}` : "Free"}</span>
      </div>
      <div className={styles.summaryRow} style={{ color: "#6b7280" }}>
        <span>Tax{taxPct !== null ? ` (${taxPct}%)` : ""}</span>
        <span>${tax.toFixed(2)}</span>
      </div>
      <div className={styles.summaryTotal}>
        <span>Total</span>
        <span>${total.toFixed(2)}</span>
      </div>
      {!paymentFormReady && (
        <p className={styles.error}>
          The payment form could not be loaded. Refresh the page to try again.
        </p>
      )}
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.actions}>
        <button
          className={styles.btnSecondary}
          onClick={onBack}
          disabled={loading}
        >
          ← Back
        </button>
        <button
          className={styles.btnPrimary}
          onClick={handlePay}
          disabled={loading || !paymentFormReady}
        >
          {loading ? "Processing..." : `Pay $${total.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}
