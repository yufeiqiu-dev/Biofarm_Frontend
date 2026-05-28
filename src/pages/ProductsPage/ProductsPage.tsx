import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getProducts } from "../../api/product";
import { getTags } from "../../api/tag";
import type { Product } from "../../types/product_type";
import type { Tag } from "../../types/tag_type";
import { ProductCard } from "../../components/ProductCard";
import { LoadingOverlay } from "../../components/LoadingSpinner";
import shared from "../../styles/shared.module.css";
import styles from "./ProductsPage.module.css";

export function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const activeTag = searchParams.get("tag") ?? "";

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getTags().then(setAllTags).catch(() => {});
  }, []);

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

  const displayedProducts = useMemo(() => {
    if (!activeTag) return allProducts;
    return allProducts.filter((p) => (p.tags ?? []).some((t) => t.name === activeTag));
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

      {allTags.length > 0 && (
        <div className={styles.tagList}>
          {allTags.map((tag) => (
            <button
              key={tag.id}
              className={`${styles.tagPill} ${activeTag === tag.name ? styles.tagPillActive : ""}`}
              onClick={() => handleTagClick(tag.name)}
            >
              {tag.name}
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
