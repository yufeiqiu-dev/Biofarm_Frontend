import type { ReactNode } from "react";
import type { Product } from "../../types/product_type";
import styles from "./ProductCard.module.css";

interface Props {
  /**
   * Unused by the grid itself, but kept so pages hand the list its data rather
   * than only its rendered children - the empty and count states read from it.
   */
  products: Product[];
  children: ReactNode;
}

/**
 * The grid the cards sit in.
 *
 * `auto-fill` with a minimum rather than a fixed column count, so the number of
 * columns follows the width instead of a set of breakpoints, and
 * `align-items: stretch` (the default) lets every card in a row take the height
 * of the tallest - which is what the card's internal layout relies on to line
 * up its footers.
 */
export function ProductList({ products, children }: Props) {
  return (
    <div className={styles.grid} data-count={products.length}>
      {children}
    </div>
  );
}
