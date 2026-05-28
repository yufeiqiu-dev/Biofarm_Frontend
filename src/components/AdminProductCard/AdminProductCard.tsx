import { Link } from "react-router-dom";
import type { Product } from "../../types/product_type";
import { DEFAULT_PRODUCT_IMAGE } from "../../constants/product";
import styles from "./AdminProductCard.module.css";

interface Props {
  product: Product;
  checked: boolean;
  onToggle: (productId: string) => void;
}

export function AdminProductCard({ product, checked, onToggle }: Props) {
  const defaultVariant = product.variants[0];
  const primaryImage = product.image_urls[0] ?? DEFAULT_PRODUCT_IMAGE;

  return (
    <div className={styles.row}>
      <div className={styles.checkboxCell}>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(product.id)}
        />
      </div>

      <Link to={`/admin/products/${product.id}`} className={styles.imageCell}>
        <img
          src={primaryImage}
          alt={product.name}
          className={styles.image}
          onError={(e) => { e.currentTarget.src = DEFAULT_PRODUCT_IMAGE; }}
        />
      </Link>

      <div className={styles.content}>
        <Link to={`/admin/products/${product.id}`} className={styles.name}>
          {product.name}
        </Link>

        <p className={styles.description}>{product.description}</p>

        <div className={styles.meta}>
          <span>
            {defaultVariant ? `$${defaultVariant.price.toFixed(2)}` : "-"}
          </span>
          <span>
            {product.variants.length} variant{product.variants.length > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className={styles.actions}>
        <Link to={`/admin/products/${product.id}`} className={styles.editButton}>
          Edit
        </Link>
      </div>
    </div>
  );
}