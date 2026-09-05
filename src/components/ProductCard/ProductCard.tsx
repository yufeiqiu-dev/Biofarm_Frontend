import { Link } from "react-router-dom";
import type { Product } from "../../types/product_type";
import type { AddToCartItem } from "../../types/cart_types";
import { AddToCartButton } from "../AddToCartButton";
import { DEFAULT_PRODUCT_IMAGE } from "../../constants/product";
import { formatPriceRange, formatSizeRange, stockSummary } from "./productSummary";
import styles from "./ProductCard.module.css";

interface Props {
  product: Product;
}

/**
 * A product card.
 *
 * The card structure is fixed rather than growing with its content - image,
 * identity, description, specs, then a footer pinned to the bottom - so price
 * and button land on the same line across a row of cards however long the
 * descriptions happen to be. Cards that each size themselves leave the buy
 * buttons at four different heights, which is what makes a grid look untidy.
 */
export function ProductCard({ product }: Props) {
  const cheapest = [...product.variants].sort((a, b) => a.price - b.price)[0];
  const stock = stockSummary(product.variants);
  const thumbnail = product.image_urls[0];

  const item: AddToCartItem | null = cheapest
    ? {
        productId: product.id,
        variantId: cheapest.id,
        name: product.name,
        // The cart shows its own thumbnail, and an empty src makes the browser
        // re-request the page and render a broken image.
        imageUrl: thumbnail ?? DEFAULT_PRODUCT_IMAGE,
        catalogNumber: cheapest.catalog_id,
        sizeLabel: `${cheapest.size_value}${cheapest.size_unit}`,
        unitPrice: cheapest.price,
        quantity: 1,
      }
    : null;

  return (
    <article className={styles.card}>
      <Link
        to={`/products/${product.id}`}
        className={styles.figure}
        tabIndex={-1}
        aria-hidden="true"
      >
        {thumbnail ? (
          <img src={thumbnail} alt="" className={styles.image} loading="lazy" />
        ) : (
          /*
           * Not "Image Not Available". Six identical grey boxes apologising in
           * 24px grey is worse than saying something true, and the catalog ID
           * is what identifies this product anyway. The space stays reserved so
           * the cards keep a common height whether or not a photo exists - and
           * this no longer reaches dummyimage.com for a placeholder.
           */
          <span className={styles.figureFallback}>{product.cat_id}</span>
        )}
      </Link>

      <div className={styles.body}>
        <Link to={`/products/${product.id}`} className={styles.identity}>
          <span className={styles.catId}>{product.cat_id}</span>
          <h3 className={styles.name}>{product.name}</h3>
        </Link>

        {product.tags.length > 0 && (
          <ul className={styles.tags}>
            {product.tags.map((tag) => (
              <li key={tag.id} className={styles.tag}>
                {tag.name}
              </li>
            ))}
          </ul>
        )}

        <p className={styles.description}>{product.description}</p>

        {/*
          Size and availability as a two-row spec list rather than prose. These
          are the two things being compared across cards, so they sit in the
          same place on every one.
        */}
        <dl className={styles.spec}>
          <dt className={styles.specKey}>Size</dt>
          <dd className={styles.specValue}>{formatSizeRange(product.variants)}</dd>
          <dt className={styles.specKey}>Availability</dt>
          <dd className={`${styles.specValue} ${styles[stock.tone]}`}>{stock.label}</dd>
        </dl>

        <div className={styles.footer}>
          <span className={styles.price}>{formatPriceRange(product.variants)}</span>
          {item && <AddToCartButton item={item} available={stock.total} />}
        </div>
      </div>
    </article>
  );
}
