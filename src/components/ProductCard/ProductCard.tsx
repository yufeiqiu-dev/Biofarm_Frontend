import type { Product } from "../../types/product_type";
import shared from "../../styles/shared.module.css";
import styles from "./ProductCard.module.css";
import { useCartSideBar } from "../../context/CartSideBarContext";
import { useReminder } from "../../context/ReminderContext";
import { useAuth } from "../../auth/AuthContext";

interface Props {
  product: Product;
}

export function ProductCard({ product }: Props) {
  const { addToCart, cartItems } = useCartSideBar();
  const { user } = useAuth();
  const { showReminder } = useReminder();
  const isInCart = cartItems.some((item) => item.productId === product.id);
  const handleAddToCart = () => {
    if (!user) {
      showReminder({
        message: "Please sign in before adding items to your cart.",
      });
      return;
    }
    addToCart({
      id: product.id,
      productId: product.id,
      variantId: product.variants[0].id,
      name: product.name,
      imageUrl: product.imageUrl,
      catalogNumber: product.catolog_id,
      sizeLabel: product.variants[0].size_value + product.variants[0].size_unit,
      unitPrice: product.variants[0].price,
      quantity: 1,
    });
  };
  return (
    <div className={styles.card}>
      <img src={product.imageUrl} alt={product.name} className={styles.image} />
      <div className={styles.body}>
        <h3 className={styles.name}>{product.name}</h3>
        <p className={styles.description}>{product.description}</p>
        <div className={styles.footer}>
          <span className={styles.price}>${product.variants[0].price.toFixed(2)}</span>
          <button className={shared.primaryButton} onClick={handleAddToCart} disabled={isInCart}>{isInCart ? "In Cart" : "Add to cart"}</button>
        </div>
      </div>
    </div>
  );
}

