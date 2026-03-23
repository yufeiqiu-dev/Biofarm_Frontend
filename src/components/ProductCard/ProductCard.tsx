import type { Product } from "../../types/product_type";
import shared from "../../styles/shared.module.css";
import styles from "./ProductCard.module.css";

interface Props {
  product: Product;
}

export function ProductCard({ product }: Props) {
  return (
    <div className={styles.card}>
      <img src={product.imageUrl} alt={product.name} className={styles.image} />
      <div className={styles.body}>
        <h3 className={styles.name}>{product.name}</h3>
        <p className={styles.description}>{product.description}</p>
        <div className={styles.footer}>
          <span className={styles.price}>${product.variants[0].price.toFixed(2)}</span>
          <button className={shared.primaryButton}>Add to cart</button>
        </div>
      </div>
    </div>
  );
}

