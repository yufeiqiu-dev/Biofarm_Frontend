import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getProducts } from "../../api/product";
import type { Product } from "../../types/product_type";
import { ProductCard } from "../../components/ProductCard";
import { SearchBar } from "../../components/SearchBar";
import { LoadingOverlay } from "../../components/LoadingSpinner";
import shared from "../../styles/shared.module.css";
import styles from "./ProductsPage.module.css";

export function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const activeTag = searchParams.get("tag") ?? "";

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getProducts({ search: search || undefined });
        setAllProducts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load products");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [search]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    allProducts.forEach((p) => (p.tags ?? []).forEach((t) => tags.add(t)));
    return [...tags].sort();
  }, [allProducts]);

  const displayedProducts = useMemo(() => {
    if (!activeTag) return allProducts;
    return allProducts.filter((p) => (p.tags ?? []).includes(activeTag));
  }, [allProducts, activeTag]);

  const handleTagClick = (tag: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (next.get("tag") === tag) {
        next.delete("tag");
      } else {
        next.set("tag", tag);
      }
      return next;
    });
  };

  if (loading) return <LoadingOverlay visible={true} />;

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

      <div className={styles.controls}>
        <SearchBar basePath="/products" />
      </div>

      {allTags.length > 0 && (
        <div className={styles.tagList}>
          {allTags.map((tag) => (
            <button
              key={tag}
              className={`${styles.tagPill} ${activeTag === tag ? styles.tagPillActive : ""}`}
              onClick={() => handleTagClick(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {displayedProducts.length === 0 ? (
        <p className={styles.empty}>No products found.</p>
      ) : (
        <div className={shared.productGrid}>
          {displayedProducts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
