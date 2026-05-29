import { Link } from "react-router-dom";
import styles from "./CartProductCard.module.css";

export interface CartItem {
  id: string;
  productId: string;
  variantId: string;
  name: string;
  imageUrl: string;
  catalogNumber: string;
  sizeLabel: string;
  unitPrice: number;
  quantity: number;
}

type CartProductCardProps = {
  item: CartItem;
  onIncrease: (itemId: string) => void;
  onDecrease: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onNavigate: () => void;
};

export function CartProductCard({
  item,
  onIncrease,
  onDecrease,
  onRemove,
  onNavigate,
}: CartProductCardProps) {
  const subtotal = item.unitPrice * item.quantity;
  const productPath = `/products/${item.productId}`;

  return (
    <article className={styles.card}>
      <Link to={productPath} onClick={onNavigate} className={styles.imageLink}>
        <img
          src={item.imageUrl}
          alt={item.name}
          className={styles.image}
        />
      </Link>

      <div className={styles.content}>
        <div className={styles.topRow}>
          <div>
            <Link to={productPath} onClick={onNavigate} className={styles.nameLink}>
              <h3 className={styles.name}>{item.name}</h3>
            </Link>
            <p className={styles.meta}>Cat. No: {item.catalogNumber}</p>
            <p className={styles.meta}>Size: {item.sizeLabel}</p>
          </div>

          <button
            type="button"
            className={styles.removeButton}
            onClick={() => onRemove(item.id)}
            aria-label="Remove item"
          >
            🗑
          </button>
        </div>

        <div className={styles.bottomRow}>
          <div className={styles.quantityControls}>
            <button
              type="button"
              className={styles.quantityButton}
              onClick={() => onDecrease(item.id)}
              disabled={item.quantity <= 1}
            >
              -
            </button>

            <span className={styles.quantityValue}>{item.quantity}</span>

            <button
              type="button"
              className={styles.quantityButton}
              onClick={() => onIncrease(item.id)}
            >
              +
            </button>
          </div>

          <div className={styles.priceBlock}>
            <p className={styles.unitPrice}>${item.unitPrice.toFixed(2)} each</p>
            <p className={styles.subtotal}>${subtotal.toFixed(2)}</p>
          </div>
        </div>
      </div>
    </article>
  );
}