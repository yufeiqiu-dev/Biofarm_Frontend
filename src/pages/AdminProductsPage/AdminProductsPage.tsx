import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Product } from "../../types/product_type";
import { AdminProductCard } from "../../components/AdminProductCard";
import { SearchBar } from "../../components/SearchBar";
import { LoadingOverlay } from "../../components/LoadingSpinner";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { getAdminProducts, deleteProduct } from "../../api/admin_product";
import { useReminder } from "../../context/ReminderContext";
import styles from "./AdminProductsPage.module.css";



export function AdminProductsPage() {
  const { showReminder } = useReminder();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [searchParams] = useSearchParams();

  const searchTerm = searchParams.get("search")?.trim().toLowerCase() ?? "";

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        const data = await getAdminProducts();
        setProducts(data);
      } catch (error) {
        console.error("Failed to load products", error);
        setLoadError(error instanceof Error ? error.message : "Failed to load products");
      } finally {
        setLoading(false);
      }
    };

    void loadProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;

    return products.filter((product) => {
      const matchesProduct =
        product.name.toLowerCase().includes(searchTerm) ||
        product.cat_id.toLowerCase().includes(searchTerm) ||
        product.description.toLowerCase().includes(searchTerm);

      const matchesVariant = product.variants.some((variant) =>
        variant.catalog_id.toLowerCase().includes(searchTerm)
      );

      return matchesProduct || matchesVariant;
    });
  }, [products, searchTerm]);

  const selectedCount = selectedProductIds.length;

  const allSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((product) => selectedProductIds.includes(product.id));

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const toggleSelectAll = () => {
    setSelectedProductIds((prev) => {
      const filteredIds = filteredProducts.map((product) => product.id);

      if (allSelected) {
        return prev.filter((id) => !filteredIds.includes(id));
      }

      return Array.from(new Set([...prev, ...filteredIds]));
    });
  };

  const handleDeleteSelected = () => {
    if (selectedProductIds.length === 0) return;
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    setConfirmOpen(false);
    const idsToDelete = [...selectedProductIds];
    try {
      setDeleting(true);
      await Promise.all(idsToDelete.map((id) => deleteProduct(id)));
      setProducts((prev) =>
        prev.filter((product) => !idsToDelete.includes(product.id))
      );
      setSelectedProductIds([]);
    } catch (error) {
      console.error("Failed to delete selected products", error);
      showReminder({ message: "Failed to delete some products. Please try again." });
    } finally {
      setDeleting(false);
    }
  };

  const selectedSet = useMemo(
    () => new Set(selectedProductIds),
    [selectedProductIds]
  );

  if (loading || deleting) {
    return <LoadingOverlay visible={true} />;
  }

  if (loadError) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Manage Products</h1>
        <p style={{ color: "#b42318", marginTop: 16 }}>
          Failed to load products: {loadError}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete products"
        message={`Delete ${selectedCount} selected product(s)? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setConfirmOpen(false)}
        variant="danger"
      />

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Manage Products</h1>
          <p className={styles.subtitle}>Add, update, or remove products.</p>
        </div>

        <div className={styles.topActions}>
          <Link to="/admin/tags" className={styles.tagsButton}>
            Manage Tags
          </Link>

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
        <div className={styles.searchWrapper}>
          <SearchBar
            placeholder="Search products in admin..."
            basePath="/admin/products"
          />
        </div>

        <div className={styles.selectionControls}>
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
      </div>

      <div className={styles.tableHeader}>
        <div /> {/* checkbox column */}
        <div /> {/* image column */}
        <div>PRODUCT</div>
        <div>TAGS</div>
        <div>PRICE</div>
        <div>STOCK</div>
        <div /> {/* edit button column */}
      </div>

      <div className={styles.list}>
        {filteredProducts.map((product) => (
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