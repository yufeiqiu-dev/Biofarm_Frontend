import { Link } from "react-router-dom";
import type { Product } from "../../types/product_type";
import type { AddToCartItem } from "../../types/cart_types";
import { AddToCartButton } from "../AddToCartButton";
import { formatPriceRange, formatSizeRange, stockSummary } from "./productSummary";
import styles from "./ProductCard.module.css";

interface Props {
  product: Product;
}

/**
 * A catalogue entry, not a shop card.
 *
 * Reads as a row on desktop and stacks on mobile. The reasoning: a researcher
 * comparing five antibodies wants price, size and availability lined up down a
 * column, which a grid of cards cannot do - and with no product images a card
 * grid is mostly empty space with an apology in the middle of it.
 *
 * The catalog ID leads because it is the product's real name in this world: it
 * is what gets searched, written down, and cited in a Methods section.
 */
export function ProductCard({ product }: Props) {
  const cheapest = [...product.variants].sort((a, b) => a.price - b.price)[0];
  const stock = stockSummary(product.variants);

  const item: AddToCartItem | null = cheapest
    ? {
        productId: product.id,
        variantId: cheapest.id,
        name: product.name,
        imageUrl: product.image_urls[0] ?? "",
        catalogNumber: cheapest.catalog_id,
        sizeLabel: `${cheapest.size_value}${cheapest.size_unit}`,
        unitPrice: cheapest.price,
        quantity: 1,
      }
    : null;

  return (
    <article className={styles.row}>
      <Link to={`/products/${product.id}`} className={styles.identity}>
        <span className={styles.catId}>{product.cat_id}</span>
        <span className={styles.name}>{product.name}</span>
        {product.tags.length > 0 && (
          <span className={styles.tags}>
            {product.tags.map((tag) => tag.name).join(", ")}
          </span>
        )}
      </Link>

      <span className={styles.size}>{formatSizeRange(product.variants)}</span>

      <span className={styles.price}>{formatPriceRange(product.variants)}</span>

      <span className={`${styles.stock} ${styles[stock.tone]}`}>{stock.label}</span>

      <span className={styles.action}>
        {item && <AddToCartButton item={item} available={stock.total} />}
      </span>
    </article>
  );
}
