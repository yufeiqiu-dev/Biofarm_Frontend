import { Link } from "react-router-dom";
import type { Product } from "../../types/product_type";
import type { AddToCartItem } from "../../types/cart_types";
import styles from "./ProductCard.module.css";
import { AddToCartButton } from "../AddToCartButton";

interface Props {
  product: Product;
}

export function ProductCard({ product }: Props) {
  const constructAddToCartItem = (): AddToCartItem => {
    const defaultVariant = product.variants[0];

    return {
      productId: product.id,
      variantId: defaultVariant.id,
      name: product.name,
      imageUrl: product.imageUrl,
      catalogNumber: defaultVariant.catalog_id,
      sizeLabel: `${defaultVariant.size_value}${defaultVariant.size_unit}`,
      unitPrice: defaultVariant.price,
      quantity: 1,
    };
  };

  return (
    <div className={styles.card}>
      <Link to={`/products/${product.id}`} className={styles.imageLink}>
        <img src={product.imageUrl} alt={product.name} className={styles.image} />
      </Link>

      <div className={styles.body}>
        <Link to={`/products/${product.id}`} className={styles.nameLink}>
          {product.name}
        </Link>

        <p className={styles.description}>{product.description}</p>

        <div className={styles.footer}>
          <span className={styles.price}>
            ${product.variants[0].price.toFixed(2)}
          </span>

          <AddToCartButton item={constructAddToCartItem()} />
        </div>
      </div>
    </div>
  );
}