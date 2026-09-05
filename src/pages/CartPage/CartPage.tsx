import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { useCartSideBar } from "../../context/useCartSideBar";
import { CartProductCard } from "../../components/CartProductCard";
import styles from "./CartPage.module.css";

export function CartPage() {
  const { cartItems, increaseQuantity, decreaseQuantity, removeFromCart } = useCartSideBar();
  const { isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();

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
    // A signed-out shopper always has an empty cart - it is stored per user and
    // cleared on sign-out - so "your cart is empty" is true but unhelpful, and
    // offering only "browse products" makes this a dead end for someone who had
    // items a moment ago. Say which of the two situations they are in.
    return (
      <div className={styles.page}>
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🛒</div>
          {isAuthenticated ? (
            <>
              <p>Your cart is empty.</p>
              <Link to="/products" className={styles.shopLink}>Browse Products</Link>
            </>
          ) : (
            <>
              <p>Sign in to see your cart.</p>
              <button className={styles.shopLink} onClick={() => void signIn()}>
                Sign in
              </button>
              <p className={styles.signInNote}>You'll be redirected back after signing in.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Your Cart</h1>

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
