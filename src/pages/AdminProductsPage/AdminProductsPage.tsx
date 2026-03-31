import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Product } from "../../types/product_type";
import { AdminProductCard } from "../../components/AdminProductCard";
import styles from "./AdminProductsPage.module.css";

// replace this later with real API data
import { mockProducts } from "../../mock/mockProducts";

export function AdminProductsPage() {
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const products: Product[] = mockProducts;

  const selectedCount = selectedProductIds.length;

  const allSelected =
    products.length > 0 && selectedProductIds.length === products.length;

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const toggleSelectAll = () => {
    setSelectedProductIds((prev) =>
      prev.length === products.length ? [] : products.map((product) => product.id)
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedProductIds.length === 0) return;

    const confirmed = window.confirm(
      `Delete ${selectedProductIds.length} selected product(s)?`
    );

    if (!confirmed) return;

    try {
      // TODO: replace with real delete API call
      console.log("Deleting products:", selectedProductIds);

      // Example:
      // await Promise.all(selectedProductIds.map((id) => deleteProduct(id)));

      setSelectedProductIds([]);
    } catch (error) {
      console.error("Failed to delete selected products", error);
    }
  };

  const selectedSet = useMemo(() => new Set(selectedProductIds), [selectedProductIds]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Manage Products</h1>
          <p className={styles.subtitle}>Add, update, or remove products.</p>
        </div>

        <div className={styles.topActions}>
          <Link to="/admin/products/new" className={styles.addButton}>
            Add Product
          </Link>

          <button
            className={styles.deleteButton}
            onClick={handleDeleteSelected}
            disabled={selectedCount === 0}
          >
            Delete Selected
          </button>
        </div>
      </div>

      <div className={styles.toolbar}>
        <label className={styles.selectAll}>
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
          />
          <span>Select all</span>
        </label>

        <span className={styles.selectedCount}>
          {selectedCount} selected
        </span>
      </div>

      <div className={styles.list}>
        {products.map((product) => (
          <AdminProductCard
            key={product.id}
            product={product}
            checked={selectedSet.has(product.id)}
            onToggle={toggleProductSelection}
          />
        ))}
      </div>
    </div>
  );
}