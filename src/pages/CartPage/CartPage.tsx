import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { useCartSideBar } from "../../context/useCartSideBar";
import { CartProductCard } from "../../components/CartProductCard";
import styles from "./CartPage.module.css";

export function CartPage() {
  const { cartItems, unavailable, refreshCart, increaseQuantity, decreaseQuantity, removeFromCart } = useCartSideBar();
  const { isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();

  // The cart page is one of the two pull points the design doc calls for (the
  // other is signing in, handled inside the provider itself) - opening it
  // re-reconciles against the server rather than trusting whatever this
  // device happened to have on mount. A no-op for a guest.
  useEffect(() => {
    void refreshCart();
  }, [refreshCart]);

  const subtotal = cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      await signIn();
      return;
    }
    navigate("/checkout");
  };

  if (cartItems.length === 0) {
    // The basket is local-first, so a guest can have built one same as anyone
    // else - it is just this browser's, not carried anywhere yet. Empty here
    // means empty, for both; the difference between a guest and a signed-in
    // customer only matters once they try to check out.
    return (
      <div className={styles.page}>
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🛒</div>
          <p>Your cart is empty.</p>
          <Link to="/products" className={styles.shopLink}>Browse Products</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Your Cart</h1>

      {/*
        Said here rather than discovered at the Review step. The sidebar shows
        the same notice; a customer who navigates straight to /cart never sees
        that one.
      */}
      {unavailable.length > 0 && (
        <p className={styles.unavailableNotice} role="status">
          {unavailable.length === 1
            ? `${unavailable[0]} is no longer available in the quantity you wanted.`
            : `${unavailable.length} items are no longer available in the quantities you wanted.`}{" "}
          Adjust them before checking out.
        </p>
      )}

      <div className={styles.layout}>
        <div className={styles.itemsPanel}>
          {cartItems.map((item) => (
            <CartProductCard
              key={item.id}
              item={item}
              onIncrease={increaseQuantity}
              onDecrease={decreaseQuantity}
              onRemove={removeFromCart}
              onNavigate={() => {}}
            />
          ))}
        </div>

        <div className={styles.summary}>
          <h2 className={styles.summaryTitle}>Order Summary</h2>

          <div className={styles.summaryRow}>
            <span>Items ({itemCount})</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className={styles.summaryRow}>
            <span>Shipping</span>
            <span>Calculated at checkout</span>
          </div>
          <div className={styles.summaryRow}>
            <span>Tax</span>
            <span>Calculated at checkout</span>
          </div>

          <hr className={styles.summaryDivider} />

          <div className={styles.summaryTotal}>
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>

          <button className={styles.checkoutBtn} onClick={handleCheckout}>
            {isAuthenticated ? "Proceed to Checkout" : "Sign in to Checkout"}
          </button>

          {!isAuthenticated && (
            <p className={styles.signInNote}>You'll be redirected back after signing in.</p>
          )}
        </div>
      </div>
    </div>
  );
}
