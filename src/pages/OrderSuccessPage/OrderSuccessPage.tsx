import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCartSideBar } from "../../context/CartSideBarContext";
import shared from "../../styles/shared.module.css";

export function OrderSuccessPage() {
  const [searchParams] = useSearchParams();
  const { clearCart } = useCartSideBar();
  const paymentIntent = searchParams.get("payment_intent");
  const redirectStatus = searchParams.get("redirect_status");

  useEffect(() => {
    if (redirectStatus === "succeeded") {
      clearCart();
    }
  }, [redirectStatus, clearCart]);

  if (redirectStatus !== "succeeded") {
    return (
      <div className={shared.page}>
        <h1>Payment Failed</h1>
        <p>Something went wrong. Please try again.</p>
        <Link to="/cart">Return to Cart</Link>
      </div>
    );
  }

  return (
    <div className={shared.page}>
      <h1>Order Placed!</h1>
      <p>Thank you for your order. We'll review it and get back to you shortly.</p>
      {paymentIntent && (
        <p style={{ fontSize: "0.875rem", color: "#6b7280" }}>
          Reference: {paymentIntent}
        </p>
      )}
      <Link to="/orders">View My Orders</Link>
    </div>
  );
}
