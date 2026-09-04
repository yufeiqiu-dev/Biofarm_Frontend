import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { useAuth } from "../../auth/useAuth";
import { useCartSideBar } from "../../context/useCartSideBar";
import { createPaymentIntent } from "../../api/order";
import type { CheckoutShipping } from "../../types/order_types";
import styles from "./CheckoutPage.module.css";

const STRIPE_BYPASS = import.meta.env.VITE_STRIPE_BYPASS === "true";
const stripePromise = STRIPE_BYPASS
  ? null
  : loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string);

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

const STEP_LABELS = ["Contact", "Shipping", "Review", "Payment"];

type ContactForm = { name: string; phone: string };
type ShippingForm = {
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
};

function StepIndicator({ current }: { current: number }) {
  return (
    <div className={styles.steps}>
      {STEP_LABELS.map((label, i) => (
        <div
          key={label}
          style={{
            display: "flex",
            alignItems: "center",
            flex: i < STEP_LABELS.length - 1 ? "1" : "none",
          }}
        >
          <div
            className={`${styles.step} ${i === current ? styles.active : ""} ${i < current ? styles.completed : ""}`}
          >
            <div className={styles.stepNumber}>{i + 1}</div>
            <span>{label}</span>
          </div>
          {i < STEP_LABELS.length - 1 && <div className={styles.stepDivider} />}
        </div>
      ))}
    </div>
  );
}

function ContactStep({
  contact,
  onChange,
  onNext,
}: {
  contact: ContactForm;
  onChange: (v: ContactForm) => void;
  onNext: () => void;
}) {
  const { user } = useAuth();
  const hasEmail = !!user?.email;

  return (
    <div className={styles.card}>
      <h2>Contact Information</h2>
      <div className={styles.formGroup}>
        <label className={styles.label}>Email *</label>
        <input
          className={styles.input}
          value={user?.email ?? ""}
          disabled
        />
        {!hasEmail && (
          <p className={styles.fieldError}>
            No email is associated with your account. Please update your account email before checking out.
          </p>
        )}
      </div>
      <div className={styles.formGroup}>
        <label className={styles.label}>Full Name *</label>
        <input
          className={styles.input}
          value={contact.name}
          onChange={(e) => onChange({ ...contact, name: e.target.value })}
          placeholder="Jane Smith"
        />
      </div>
      <div className={styles.formGroup}>
        <label className={styles.label}>Phone *</label>
        <input
          className={styles.input}
          value={contact.phone}
          onChange={(e) => onChange({ ...contact, phone: e.target.value })}
          placeholder="5551234567"
        />
      </div>
      <div className={styles.actions}>
        <button
          className={styles.btnPrimary}
          onClick={onNext}
          disabled={!hasEmail || !contact.name.trim() || !contact.phone.trim()}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

function ShippingStep({
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
        <label className={styles.label}>Address Line 1 *</label>
        <input
          className={styles.input}
          value={shipping.address1}
          onChange={(e) => onChange({ ...shipping, address1: e.target.value })}
          placeholder="123 Main St"
        />
      </div>
      <div className={styles.formGroup}>
        <label className={styles.label}>Address Line 2</label>
        <input
          className={styles.input}
          value={shipping.address2}
          onChange={(e) => onChange({ ...shipping, address2: e.target.value })}
          placeholder="Apt 4B"
        />
      </div>
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.label}>City *</label>
          <input
            className={styles.input}
            value={shipping.city}
            onChange={(e) => onChange({ ...shipping, city: e.target.value })}
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>State *</label>
          <select
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
        <label className={styles.label}>ZIP Code *</label>
        <input
          className={styles.input}
          value={shipping.zip}
          onChange={(e) => onChange({ ...shipping, zip: e.target.value })}
          placeholder="62701"
        />
      </div>
      <div className={styles.formGroup}>
        <label className={styles.label}>Order Notes</label>
        <textarea
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

function ReviewStep({
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

function PaymentForm({
  onBack,
  subtotalCents,
  taxAmountCents,
}: {
  clientSecret: string;
  onBack: () => void;
  subtotalCents: number;
  taxAmountCents: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
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
  const tax = taxAmountCents / 100;
  const total = subtotal + tax;
  const taxPct = subtotalCents > 0
    ? parseFloat((taxAmountCents / subtotalCents * 100).toFixed(2))
    : 0;

  return (
    <div className={styles.card}>
      <h2>Payment</h2>
      <PaymentElement />
      <div className={styles.summaryRow} style={{ marginTop: "1.25rem", color: "#6b7280" }}>
        <span>Subtotal</span>
        <span>${subtotal.toFixed(2)}</span>
      </div>
      <div className={styles.summaryRow} style={{ color: "#6b7280" }}>
        <span>Tax ({taxPct}%)</span>
        <span>${tax.toFixed(2)}</span>
      </div>
      <div className={styles.summaryTotal}>
        <span>Total</span>
        <span>${total.toFixed(2)}</span>
      </div>
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
          disabled={loading || !stripe}
        >
          {loading ? "Processing..." : `Pay $${total.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const { cartItems } = useCartSideBar();

  const [step, setStep] = useState(0);
  const [contact, setContact] = useState<ContactForm>({ name: "", phone: "" });
  const [shipping, setShipping] = useState<ShippingForm>({
    address1: "",
    address2: "",
    city: "",
    state: "",
    zip: "",
    notes: "",
  });
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [subtotalCents, setSubtotalCents] = useState(0);
  const [taxAmountCents, setTaxAmountCents] = useState(0);
  const [piLoading, setPiLoading] = useState(false);
  const [piError, setPiError] = useState<string | null>(null);

  if (cartItems.length === 0) {
    navigate("/cart");
    return null;
  }

  const handleProceedToPayment = async () => {
    setPiError(null);
    setPiLoading(true);
    try {
      const cartPayload = cartItems.map((i) => ({
        variant_id: i.variantId,
        quantity: i.quantity,
      }));
      const shippingPayload: CheckoutShipping = {
        name: contact.name,
        phone: contact.phone,
        address1: shipping.address1,
        address2: shipping.address2 || undefined,
        city: shipping.city,
        state: shipping.state,
        zip: shipping.zip,
        notes: shipping.notes || undefined,
      };
      const { client_secret, order_id, subtotal_cents, tax_amount_cents } = await createPaymentIntent(
        cartPayload,
        shippingPayload
      );

      setSubtotalCents(subtotal_cents);
      setTaxAmountCents(tax_amount_cents);

      if (STRIPE_BYPASS) {
        window.location.href = `/checkout/success?payment_intent=${order_id ?? "bypass"}&redirect_status=succeeded`;
        return;
      }

      setClientSecret(client_secret);
      setStep(3);
    } catch (e) {
      setPiError(
        e instanceof Error ? e.message : "Failed to initiate payment."
      );
    } finally {
      setPiLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <StepIndicator current={step} />

      {step === 0 && (
        <ContactStep
          contact={contact}
          onChange={setContact}
          onNext={() => setStep(1)}
        />
      )}
      {step === 1 && (
        <ShippingStep
          shipping={shipping}
          onChange={setShipping}
          onBack={() => setStep(0)}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <>
          <ReviewStep
            contact={contact}
            shipping={shipping}
            onBack={() => setStep(1)}
            onNext={handleProceedToPayment}
            loading={piLoading}
          />
          {piError && <p className={styles.error}>{piError}</p>}
        </>
      )}
      {step === 3 && clientSecret && (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <PaymentForm
            clientSecret={clientSecret}
            onBack={() => setStep(2)}
            subtotalCents={subtotalCents}
            taxAmountCents={taxAmountCents}
          />
        </Elements>
      )}
    </div>
  );
}
