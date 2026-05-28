import { Link } from "react-router-dom";
import type { Product } from "../../types/product_type";
import type { AddToCartItem } from "../../types/cart_types";
import { DEFAULT_PRODUCT_IMAGE } from "../../constants/product";
import styles from "./ProductCard.module.css";
import { AddToCartButton } from "../AddToCartButton";

interface Props {
  product: Product;
}

export function ProductCard({ product }: Props) {
  const primaryImage = product.image_urls[0] ?? DEFAULT_PRODUCT_IMAGE;

  const constructAddToCartItem = (): AddToCartItem => {
    const defaultVariant = product.variants[0];

    return {
      productId: product.id,
      variantId: defaultVariant.id,
      name: product.name,
      imageUrl: primaryImage,
      catalogNumber: defaultVariant.catalog_id,
      sizeLabel: `${defaultVariant.size_value}${defaultVariant.size_unit}`,
      unitPrice: defaultVariant.price,
      quantity: 1,
    };
  };

  return (
    <div className={styles.card}>
      <Link to={`/products/${product.id}`} className={styles.imageLink}>
        <img
          src={primaryImage}
          alt={product.name}
          className={styles.image}
          onError={(e) => { e.currentTarget.src = DEFAULT_PRODUCT_IMAGE; }}
        />
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
