import styles from "./CartSideBar.module.css";
import { useCartSideBar } from "../../context/CartSideBarContext";
import { CartProductCard } from "../CartProductCard";
type CartSideBarProps = {
    topOffset: number;
  };

  export function CartSideBar({ topOffset }: CartSideBarProps) {
    const { isOpen, closeCartSideBar, cartItems, increaseQuantity, decreaseQuantity, removeFromCart } = useCartSideBar();
  
    return (
      <>
        <div
          className={`${styles.backdrop} ${isOpen ? styles.backdropOpen : ""}`}
          onClick={closeCartSideBar}
        />
  
        <aside
          className={`${styles.cartSideBar} ${isOpen ? styles.open : styles.closed}`}
          style={{
            top: `${topOffset}px`,
            height: `calc(100vh - ${topOffset}px)`,
          }}
        >
          <h2>Cart</h2>
          {cartItems.map((item) => (
            <CartProductCard key={item.id} item={item} onIncrease={increaseQuantity} onDecrease={decreaseQuantity} onRemove={removeFromCart} />
          ))}
        </aside>
      </>
    );
  }