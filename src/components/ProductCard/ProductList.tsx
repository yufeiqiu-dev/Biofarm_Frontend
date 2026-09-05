import type { ReactNode } from "react";
import type { Product } from "../../types/product_type";
import styles from "./ProductCard.module.css";

interface Props {
  products: Product[];
  children: ReactNode;
}

/**
 * The grid that the rows sit in.
 *
 * This exists because column alignment is the whole idea: price, size and stock
 * only compare if they line up down the page. Each row styling itself as its
 * own grid does not achieve that - the tracks are computed per row, so a row
 * with a thumbnail and a row without end up with different column widths, and
 * the button wraps on some rows and not others.
 *
 * The template lives here and the rows take it with `subgrid`, so there is one
 * definition and every row obeys it.
 */
export function ProductList({ products, children }: Props) {
  // The thumbnail column exists only if something in view actually has an
  // image. Otherwise it collapses, rather than reserving an empty gutter down
  // a list of products that have no pictures.
  const anyImages = products.some((product) => product.image_urls.length > 0);

  return (
    <div className={styles.list} data-thumbs={anyImages ? "yes" : "no"}>
      {children}
    </div>
  );
}
