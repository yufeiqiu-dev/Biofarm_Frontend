import { Link } from "react-router-dom";
import styles from "./CartSideBar.module.css";
import { useCartSideBar } from "../../context/CartSideBarContext";
import { CartProductCard } from "../CartProductCard";

export function CartSideBar() {
  const { isOpen, closeCartSideBar, cartItems, increaseQuantity, decreaseQuantity, removeFromCart } = useCartSideBar();

  const subtotal = cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      <div
        className={`${styles.backdrop} ${isOpen ? styles.backdropOpen : ""}`}
        onClick={closeCartSideBar}
      />

      <aside className={`${styles.cartSideBar} ${isOpen ? styles.open : styles.closed}`}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            Cart
            {itemCount > 0 && <span className={styles.count}>{itemCount}</span>}
          </h2>
          <button className={styles.closeBtn} onClick={closeCartSideBar} aria-label="Close cart">✕</button>
        </div>

        <div className={styles.items}>
          {cartItems.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyText}>Your cart is empty.</p>
              <Link to="/products" className={styles.shopLink} onClick={closeCartSideBar}>
                Browse Products
              </Link>
            </div>
          ) : (
            cartItems.map((item) => (
              <CartProductCard
                key={item.id}
                item={item}
                onIncrease={increaseQuantity}
                onDecrease={decreaseQuantity}
                onRemove={removeFromCart}
                onNavigate={closeCartSideBar}
              />
            ))
          )}
        </div>

        {cartItems.length > 0 && (
          <div className={styles.footer}>
            <div className={styles.subtotalRow}>
              <span>Subtotal</span>
              <span className={styles.subtotalAmount}>${subtotal.toFixed(2)}</span>
            </div>
            <Link to="/cart" className={styles.checkoutBtn} onClick={closeCartSideBar}>
              View Cart →
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}