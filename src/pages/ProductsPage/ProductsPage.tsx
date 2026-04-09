import { mockProducts } from "../../mock/mockProducts";
import { ProductCard } from "../../components/ProductCard";
import shared from "../../styles/shared.module.css";
import styles from "./ProductsPage.module.css";

export function ProductsPage() {
  return (
    <div className={shared.page}>
      <h1 className={styles.title}>All Products</h1>
      <div className={shared.productGrid}>
        {mockProducts.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}

