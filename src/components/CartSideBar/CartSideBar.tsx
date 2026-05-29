import { Link } from "react-router-dom";
import styles from "./CartSideBar.module.css";
import { useCartSideBar } from "../../context/CartSideBarContext";
import { CartProductCard } from "../CartProductCard";

export function CartSideBar() {
  const { isOpen, closeCartSideBar, cartItems, increaseQuantity, decreaseQuantity, removeFromCart } = useCartSideBar();

  return (
    <>
      <div
        className={`${styles.backdrop} ${isOpen ? styles.backdropOpen : ""}`}
        onClick={closeCartSideBar}
      />

      <aside
        className={`${styles.cartSideBar} ${isOpen ? styles.open : styles.closed}`}
      >
        <h2>Cart</h2>
        <div className={styles.items}>
          {cartItems.length === 0 ? (
            <p className={styles.empty}>Your cart is empty.</p>
          ) : (
            cartItems.map((item) => (
              <CartProductCard key={item.id} item={item} onIncrease={increaseQuantity} onDecrease={decreaseQuantity} onRemove={removeFromCart} onNavigate={closeCartSideBar} />
            ))
          )}
        </div>
        {cartItems.length > 0 && (
          <div className={styles.footer}>
            <Link to="/checkout" className={styles.checkoutBtn} onClick={closeCartSideBar}>
              Checkout →
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}