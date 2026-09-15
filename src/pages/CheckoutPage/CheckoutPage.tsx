import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { PageLoading } from "../../components/LoadingSpinner";
import { useAuth } from "../../auth/useAuth";
import { useCartSideBar } from "../../context/useCartSideBar";
import { createPaymentIntent } from "../../api/order";
import type { CheckoutShipping } from "../../types/order_types";
import { ContactStep } from "./ContactStep";
import { PaymentForm } from "./PaymentForm";
import { ReviewStep } from "./ReviewStep";
import { ShippingStep } from "./ShippingStep";
import { StepIndicator } from "./StepIndicator";
import type { ContactForm, ShippingForm } from "./checkoutForms";
import styles from "./CheckoutPage.module.css";

const STRIPE_BYPASS = import.meta.env.VITE_STRIPE_BYPASS === "true";
const stripePromise = STRIPE_BYPASS
  ? null
  : loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string);

export function CheckoutPage() {
  const navigate = useNavigate();
  const { cartItems, refreshCart } = useCartSideBar();
  const { user } = useAuth();

  /*
   * The basket is local-first and already on screen synchronously from
   * mount - but this device's copy of it may be stale (items added on
   * another device, or via a guest basket merged in on some earlier sign-in
   * this device never pulled). Checkout is the one place that stakes money on
   * the answer, so it waits for its own explicit pull rather than trusting
   * whatever localStorage happened to hold on arrival - a deep link straight
   * to /checkout has no other pull point before this one.
   */
  const [reconciling, setReconciling] = useState(true);
  useEffect(() => {
    let active = true;
    void refreshCart().finally(() => {
      if (active) setReconciling(false);
    });
    return () => {
      active = false;
    };
  }, [refreshCart]);

  const [step, setStep] = useState(0);
  const [contact, setContact] = useState<ContactForm>({ name: "", phone: "", email: "" });

  /*
   * Prefilled rather than defaulted, because `user` is null on the first render
   * while Amplify restores the session. Only fills an untouched field, so it
   * cannot overwrite an address the customer has already typed.
   */
  useEffect(() => {
    if (!user?.email) return;
    setContact((prev) => (prev.email ? prev : { ...prev, email: user.email as string }));
  }, [user?.email]);
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
  const [shippingAmountCents, setShippingAmountCents] = useState(0);
  const [piLoading, setPiLoading] = useState(false);
  const [piError, setPiError] = useState<string | null>(null);

  /*
   * An empty basket belongs on the cart page - but only once the pull above
   * has actually run. Navigating here rather than during render, which put
   * React into an infinite update loop the one time this was tried - render,
   * navigate, render - before the basket had a chance to arrive.
   */
  useEffect(() => {
    if (reconciling) return;
    if (cartItems.length > 0) return;
    navigate("/cart");
  }, [reconciling, cartItems.length, navigate]);

  if (reconciling) {
    return <PageLoading label="Loading your cart…" />;
  }

  if (cartItems.length === 0) {
    // The effect above is on its way to the cart page; rendering the wizard
    // against an empty basket in the meantime would flash a $0.00 order.
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
      const { client_secret, order_id, subtotal_cents, tax_amount_cents, shipping_amount_cents } =
        await createPaymentIntent(
        cartPayload,
        shippingPayload,
        contact.email.trim() || undefined
      );

      setSubtotalCents(subtotal_cents);
      setTaxAmountCents(tax_amount_cents);
      setShippingAmountCents(shipping_amount_cents);

      if (STRIPE_BYPASS) {
        // order_id, in a parameter named order_id. It used to go out as
        // `payment_intent`, which it is not: bypass mode creates the order
        // inline and its PaymentIntent id is `pi_bypass_…`, so the success page
        // polled for an intent that could never match and gave up every time.
        // That was invisible while the page claimed success regardless; now
        // that it tells the truth, it would report a failed order for one that
        // was created synchronously.
        window.location.href = `/checkout/success?order_id=${order_id}&redirect_status=succeeded`;
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
            shippingAmountCents={shippingAmountCents}
          />
        </Elements>
      )}
    </div>
  );
}
