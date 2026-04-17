import { useEffect, useState } from "react";
import { getProducts } from "../../api/product";
import type { Product } from "../../types/product_type";
import { ProductCard } from "../../components/ProductCard";
import { LoadingOverlay } from "../../components/LoadingSpinner";
import { DEFAULT_PRODUCT_IMAGE } from "../../constants/product"
import shared from "../../styles/shared.module.css";
import styles from "./ProductsPage.module.css";


export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await getProducts();

        const cleanedProducts = data
          .filter((product) => product.variants.length > 0)
          .map((product) => ({
            ...product,
            image_url: DEFAULT_PRODUCT_IMAGE, // use default image for now
          }));

        setProducts(cleanedProducts);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load products");
      } finally {
        setLoading(false);
      }
    };

    void loadProducts();
  }, []);

  if (loading) {
    return <LoadingOverlay visible={true} />;
  }

  if (error) {
    return (
      <div className={shared.page}>
        <h1 className={styles.title}>All Products</h1>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className={shared.page}>
      <h1 className={styles.title}>All Products</h1>
      <div className={shared.productGrid}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}