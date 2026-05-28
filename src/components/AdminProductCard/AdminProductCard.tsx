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
  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);

  const stockClass =
    totalStock >= 10
      ? styles.stockHigh
      : totalStock >= 1
      ? styles.stockLow
      : styles.stockEmpty;

  const visibleTags = product.tags.slice(0, 3);
  const extraTagCount = Math.max(0, product.tags.length - 3);

  return (
    <div
      className={`${styles.row} ${checked ? styles.rowSelected : ""}`}
      onClick={() => onToggle(product.id)}
    >
      <div className={styles.checkboxCell}>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(product.id)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <img
        src={primaryImage}
        alt={product.name}
        className={styles.image}
        onError={(e) => {
          e.currentTarget.src = DEFAULT_PRODUCT_IMAGE;
        }}
      />

      <div className={styles.nameCell}>
        <span className={styles.name}>{product.name}</span>
        <span className={styles.catId}>{product.cat_id}</span>
      </div>

      <div className={styles.tagsCell}>
        {product.tags.length === 0 ? (
          <span className={styles.noTags}>—</span>
        ) : (
          <>
            {visibleTags.map((tag) => (
              <span key={tag.id} className={styles.tagChip}>
                {tag.name}
              </span>
            ))}
            {extraTagCount > 0 && (
              <span className={styles.extraTags}>+{extraTagCount}</span>
            )}
          </>
        )}
      </div>

      <div className={styles.priceCell}>
        {defaultVariant ? `$${defaultVariant.price.toFixed(2)}` : "—"}
      </div>

      <div className={styles.stockCell}>
        <span className={`${styles.stockBadge} ${stockClass}`}>
          {totalStock}
        </span>
      </div>

      <div className={styles.editCell}>
        <Link
          to={`/admin/products/${product.id}`}
          className={styles.editButton}
          onClick={(e) => e.stopPropagation()}
        >
          Edit
        </Link>
      </div>
    </div>
  );
}
