import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LoadingOverlay, PageLoading, useLoadingState } from "../../components/LoadingSpinner";
import { createProduct, deleteProduct, updateProduct } from "../../api/admin_product";
import { getProductById } from "../../api/product";
import { getAdminTags } from "../../api/admin_tag";
import type { Tag } from "../../types/tag_type";
import { useReminder } from "../../context/useReminder";
import { DEFAULT_PRODUCT_IMAGE } from "../../constants/product";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import styles from "./AdminProductDetailPage.module.css";
import { MAX_IMAGES, useProductImages } from "./useProductImages";

type AdminVariantForm = {
  id?: string;
  catalog_id: string;
  size_value: string;
  size_unit: string;
  price: string;
  stock: string;
};

type AdminProductForm = {
  cat_id: string;
  name: string;
  description: string;
  tag_ids: string[];
  variants: AdminVariantForm[];
};

const createEmptyVariant = (): AdminVariantForm => ({
  id: undefined,
  catalog_id: "",
  size_value: "",
  size_unit: "",
  price: "",
  stock: "",
});

const createEmptyForm = (): AdminProductForm => ({
  cat_id: "",
  name: "",
  description: "",
  tag_ids: [],
  variants: [],
});

function validateForm(form: AdminProductForm): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!form.cat_id.trim()) {
    errors.cat_id = "Product catalog ID is required.";
  }
  if (!form.name.trim()) {
    errors.name = "Product name is required.";
  }
  if (!form.description.trim()) {
    errors.description = "Product description is required.";
  }

  form.variants.forEach((variant, index) => {
    if (!variant.catalog_id.trim()) {
      errors[`variant_${index}_catalog_id`] = "Catalog ID is required.";
    }
    if (!variant.size_value.trim()) {
      errors[`variant_${index}_size_value`] = "Size value is required.";
    } else if (Number(variant.size_value) <= 0) {
      errors[`variant_${index}_size_value`] = "Size value must be greater than 0.";
    }
    if (!variant.size_unit.trim()) {
      errors[`variant_${index}_size_unit`] = "Size unit is required.";
    }
    if (!variant.price.trim()) {
      errors[`variant_${index}_price`] = "Price is required.";
    } else if (Number(variant.price) < 0) {
      errors[`variant_${index}_price`] = "Price cannot be negative.";
    }
    if (!variant.stock.trim()) {
      errors[`variant_${index}_stock`] = "Stock is required.";
    } else if (Number(variant.stock) < 0) {
      errors[`variant_${index}_stock`] = "Stock cannot be negative.";
    }
  });

  return errors;
}

export function AdminProductDetailPage() {
  const navigate = useNavigate();
  const { productId } = useParams();
  const { showReminder } = useReminder();
  const isEditMode = Boolean(productId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<AdminProductForm>(createEmptyForm());
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const images = useProductImages(showReminder);
  // Destructured because the effect below needs it as a dependency, and the
  // hook's return object is rebuilt every render - depending on the whole thing
  // would reload the product on every keystroke. `reset` itself is stable.
  const { reset: resetImages } = images;
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Stores the product ID after a successful createProduct call, so a retry after
  // a partial upload failure reuses the same product instead of creating a duplicate.
  const [pendingProductId, setPendingProductId] = useState<string | undefined>(undefined);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const load = useLoadingState(loading);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    void getAdminTags().then(setAvailableTags).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEditMode || !productId) return;

    const loadProduct = async () => {
      try {
        setLoading(true);
        setSaveError(null);

        const product = await getProductById(productId);

        setForm({
          cat_id: product.cat_id,
          name: product.name,
          description: product.description,
          tag_ids: (product.tags ?? []).map((t) => t.id),
          variants: (product.variants ?? []).map((variant) => ({
            id: variant.id,
            catalog_id: variant.catalog_id,
            size_value: String(variant.size_value),
            size_unit: variant.size_unit,
            price: String(variant.price),
            stock: String(variant.stock),
          })),
        });
        resetImages(product.image_urls ?? []);
      } catch (error) {
        console.error("Failed to load product", error);
        setSaveError(
          error instanceof Error ? error.message : "Failed to load product."
        );
      } finally {
        setLoading(false);
      }
    };

    void loadProduct();
  }, [isEditMode, productId, resetImages]);

  const handleFieldChange = (
    field: keyof AdminProductForm,
    value: string
  ) => {
    if (formErrors[field]) setFormErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
    if (saveError) setSaveError(null);
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleVariantChange = (
    index: number,
    field: keyof AdminVariantForm,
    value: string
  ) => {
    const key = `variant_${index}_${field}` as string;
    if (formErrors[key]) setFormErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
    if (saveError) setSaveError(null);
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((variant, i) =>
        i === index ? { ...variant, [field]: value } : variant
      ),
    }));
  };

  const handleAddVariant = () => {
    setForm((prev) => ({ ...prev, variants: [...prev.variants, createEmptyVariant()] }));
  };

  const handleRemoveVariant = (index: number) => {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }));
    setFormErrors((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        const m = key.match(/^variant_(\d+)_/);
        if (!m) return;
        const vi = parseInt(m[1], 10);
        if (vi === index) {
          delete next[key];
        } else if (vi > index) {
          next[key.replace(`variant_${vi}_`, `variant_${vi - 1}_`)] = next[key];
          delete next[key];
        }
      });
      return next;
    });
  };

  const handleToggleTag = (tagId: string) => {
    setForm((prev) => ({
      ...prev,
      tag_ids: prev.tag_ids.includes(tagId)
        ? prev.tag_ids.filter((id) => id !== tagId)
        : [...prev.tag_ids, tagId],
    }));
  };

  const handleFileSelect = (file: File) => {
    images.select(file);
    // Cleared either way, so choosing the same file again still fires a change.
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showReminder({ message: "Please fix errors in the form!" });
      return;
    }

    try {
      setSaving(true);
      setSaveError(null);

      const payload = {
        cat_id: form.cat_id.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        tag_ids: form.tag_ids,
        variants: form.variants.map((variant) => ({
          ...(variant.id ? { id: variant.id } : {}),
          catalog_id: variant.catalog_id.trim(),
          size_value: Number(variant.size_value),
          size_unit: variant.size_unit.trim(),
          price: Number(variant.price),
          stock: Number(variant.stock),
        })),
      };

      // In create mode, reuse the ID from a prior attempt so a retry after a
      // partial upload failure does not create a second product.
      let targetId = productId ?? pendingProductId;

      if (isEditMode && productId) {
        await images.flushDeletions(productId);
        // The display order travels with the update, so a reorder persists.
        await updateProduct(productId, { ...payload, image_urls: images.displayedUrls });
      } else if (pendingProductId) {
        // Product was created in a previous attempt — just update it.
        await updateProduct(pendingProductId, payload);
      } else {
        const created = await createProduct(payload);
        setPendingProductId(created.id);
        targetId = created.id;
      }

      // Only now, with an id to scope the S3 keys to. This is why creation has
      // to happen first for a new product.
      if (targetId) {
        await images.uploadFor(targetId);
      }

      navigate("/admin/products");
    } catch (error) {
      console.error("Failed to save product", error);
      setSaveError(
        error instanceof Error ? error.message : "Failed to save product."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditMode || !productId) return;

    try {
      setDeleting(true);
      setSaveError(null);
      await deleteProduct(productId);
      navigate("/admin/products");
    } catch (error) {
      console.error("Failed to delete product", error);
      setSaveError(
        error instanceof Error ? error.message : "Failed to delete product."
      );
    } finally {
      setDeleting(false);
    }
  };

  if (load.pending) {
    return <PageLoading visible={load.visible} />;
  }


  return (
    <div className={styles.page}>
      <LoadingOverlay
        visible={saving || deleting}
        label={deleting ? "Deleting..." : "Saving..."}
      />

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {isEditMode ? "Edit Product" : "Add Product"}
          </h1>
          <p className={styles.subtitle}>
            {isEditMode
              ? "Update product information and variants."
              : "Create a new product and add variants if needed."}
          </p>
        </div>

        <div className={styles.headerActions}>
          {isEditMode && (
            <button
              type="button"
              className={styles.deleteButton}
              onClick={() => setConfirmDeleteOpen(true)}
            >
              Delete Product
            </button>
          )}
        </div>
      </div>

      <form className={styles.form} onSubmit={handleSave}>
        {saveError && (
          <div
            style={{
              marginBottom: 16,
              padding: "12px 16px",
              border: "1px solid #f3b4b4",
              background: "#fff3f3",
              borderRadius: 8,
            }}
          >
            <p style={{ color: "#b42318", margin: 0 }}>{saveError}</p>
          </div>
        )}

        <div className={styles.mainGrid}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Basic Information</h2>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="product-product-catalog-id">Product Catalog ID</label>
              <input
                id="product-product-catalog-id"
                className={`${styles.input} ${formErrors.cat_id ? styles.inputError : ""}`}
                type="text"
                value={form.cat_id}
                onChange={(e) => handleFieldChange("cat_id", e.target.value)}
                placeholder="Enter base product catalog ID"
              />
              {formErrors.cat_id && <p className={styles.fieldError}>{formErrors.cat_id}</p>}
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="product-product-name">Product Name</label>
              <input
                id="product-product-name"
                className={`${styles.input} ${formErrors.name ? styles.inputError : ""}`}
                type="text"
                value={form.name}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                placeholder="Enter product name"
              />
              {formErrors.name && <p className={styles.fieldError}>{formErrors.name}</p>}
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="product-description">Description</label>
              <textarea
                id="product-description"
                className={`${styles.textarea} ${formErrors.description ? styles.inputError : ""}`}
                value={form.description}
                onChange={(e) => handleFieldChange("description", e.target.value)}
                placeholder="Enter product description"
                rows={6}
              />
              {formErrors.description && <p className={styles.fieldError}>{formErrors.description}</p>}
            </div>

            <div className={styles.fieldGroup}>
              {/*
                A span, not a label. Tags are toggle buttons, and a <label>
                forwards its activation to a form control - so this one was
                pointing at the image file input in the section below and
                clicking the word "Tags" opened a file picker. The chips are
                named as a group instead.
              */}
              <span className={styles.label} id="product-tags-label">Tags</span>
              {availableTags.length === 0 ? (
                <p style={{ fontSize: 13, color: "#9ca3af" }}>
                  No tags available. <a href="/admin/tags" style={{ color: "#16a34a" }}>Manage tags →</a>
                </p>
              ) : (
                <div className={styles.tagChips} role="group" aria-labelledby="product-tags-label">
                  {availableTags.map((tag) => {
                    const selected = form.tag_ids.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        className={`${styles.tagChip} ${selected ? styles.tagChipSelected : ""}`}
                        onClick={() => handleToggleTag(tag.id)}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              Product Images
              <span style={{ fontSize: 13, fontWeight: 400, color: "#667085", marginLeft: 8 }}>
                ({images.count}/{MAX_IMAGES})
              </span>
              {images.pendingDeletionCount > 0 && (
                <span style={{ fontSize: 12, fontWeight: 400, color: "#b45309", marginLeft: 8 }}>
                  {images.pendingDeletionCount} pending deletion
                </span>
              )}
            </h2>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="product-image-file">
                Add an image
              </label>
              <input
                id="product-image-file"
                ref={fileInputRef}
                className={styles.input}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                disabled={images.atLimit}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
              />
            </div>

            <div className={styles.imageGrid}>
              {images.displayedUrls.map((url, i) => (
                <div key={url} className={styles.imageItem}>
                  <img
                    src={url}
                    alt={`Product image ${i + 1}`}
                    className={styles.imageThumb}
                  />
                  {i === 0 ? (
                    <span className={styles.primaryBadge}>Primary</span>
                  ) : (
                    <button
                      type="button"
                      className={styles.setPrimaryButton}
                      onClick={() => images.makePrimary(i)}
                      title="Set as primary"
                    >
                      ★
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.deleteImageButton}
                    onClick={() => images.stageDeletion(i)}
                  >
                    ×
                  </button>
                </div>
              ))}

              {images.pendingFiles.map(({ previewUrl }, i) => (
                <div key={previewUrl} className={styles.imageItem}>
                  <img
                    src={previewUrl}
                    alt={`Pending image ${i + 1}`}
                    className={styles.imageThumb}
                  />
                  <span className={styles.pendingBadge}>Unsaved</span>
                  <button
                    type="button"
                    className={styles.deleteImageButton}
                    onClick={() => images.removePending(i)}
                  >
                    ×
                  </button>
                </div>
              ))}

              {images.count === 0 && (
                <div className={styles.imagePlaceholder}>
                  <img
                    src={DEFAULT_PRODUCT_IMAGE}
                    alt="No image"
                    className={styles.imageThumb}
                    style={{ opacity: 0.4 }}
                  />
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>No images yet</span>
                </div>
              )}
            </div>
          </section>
        </div>

        <section className={styles.section}>
          <div className={styles.variantHeader}>
            <h2 className={styles.sectionTitle}>Variants</h2>
            <button
              type="button"
              className={styles.addVariantButton}
              onClick={handleAddVariant}
            >
              Add Variant
            </button>
          </div>

          {form.variants.length === 0 ? (
            <div
              style={{
                padding: 16,
                border: "1px dashed #d0d5dd",
                borderRadius: 8,
                color: "#667085",
              }}
            >
              No variants yet. Click "Add Variant" to create one.
            </div>
          ) : (
            <div className={styles.variantList}>
              {form.variants.map((variant, index) => (
                <div key={variant.id ?? `new-${index}`} className={styles.variantCard}>
                  <div className={styles.variantCardHeader}>
                    <h3 className={styles.variantTitle}>Variant {index + 1}</h3>
                    <button
                      type="button"
                      className={styles.removeVariantButton}
                      onClick={() => handleRemoveVariant(index)}
                    >
                      Remove
                    </button>
                  </div>

                  {/*
                    No variant id field. It is a uuid the admin cannot act on -
                    read-only, and on a new variant it only ever said
                    "auto-generated". The catalog id is the identifier this
                    business actually uses. The id is still carried in form
                    state and in the payload, because update_product reconciles
                    variants by it.
                  */}
                  <div className={styles.variantGrid}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor={`product-variant-catalog-id-${index}`}>Catalog ID</label>
                      <input
                        id={`product-variant-catalog-id-${index}`}
                        className={`${styles.input} ${formErrors[`variant_${index}_catalog_id`] ? styles.inputError : ""}`}
                        type="text"
                        value={variant.catalog_id}
                        onChange={(e) =>
                          handleVariantChange(index, "catalog_id", e.target.value)
                        }
                        placeholder="Enter catalog ID"
                      />
                      {formErrors[`variant_${index}_catalog_id`] && (
                        <p className={styles.fieldError}>{formErrors[`variant_${index}_catalog_id`]}</p>
                      )}
                    </div>

                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor={`product-size-value-${index}`}>Size Value</label>
                      <input
                        id={`product-size-value-${index}`}
                        className={`${styles.input} ${formErrors[`variant_${index}_size_value`] ? styles.inputError : ""}`}
                        type="number"
                        value={variant.size_value}
                        onChange={(e) =>
                          handleVariantChange(index, "size_value", e.target.value)
                        }
                        placeholder="10"
                      />
                      {formErrors[`variant_${index}_size_value`] && (
                        <p className={styles.fieldError}>{formErrors[`variant_${index}_size_value`]}</p>
                      )}
                    </div>

                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor={`product-size-unit-${index}`}>Size Unit</label>
                      <input
                        id={`product-size-unit-${index}`}
                        className={`${styles.input} ${formErrors[`variant_${index}_size_unit`] ? styles.inputError : ""}`}
                        type="text"
                        value={variant.size_unit}
                        onChange={(e) =>
                          handleVariantChange(index, "size_unit", e.target.value)
                        }
                        placeholder="mL"
                      />
                      {formErrors[`variant_${index}_size_unit`] && (
                        <p className={styles.fieldError}>{formErrors[`variant_${index}_size_unit`]}</p>
                      )}
                    </div>

                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor={`product-price-${index}`}>Price</label>
                      <input
                        id={`product-price-${index}`}
                        className={`${styles.input} ${formErrors[`variant_${index}_price`] ? styles.inputError : ""}`}
                        type="number"
                        step="0.01"
                        value={variant.price}
                        onChange={(e) =>
                          handleVariantChange(index, "price", e.target.value)
                        }
                        placeholder="99.99"
                      />
                      {formErrors[`variant_${index}_price`] && (
                        <p className={styles.fieldError}>{formErrors[`variant_${index}_price`]}</p>
                      )}
                    </div>

                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor={`product-stock-${index}`}>Stock</label>
                      <input
                        id={`product-stock-${index}`}
                        className={`${styles.input} ${formErrors[`variant_${index}_stock`] ? styles.inputError : ""}`}
                        type="number"
                        value={variant.stock}
                        onChange={(e) =>
                          handleVariantChange(index, "stock", e.target.value)
                        }
                        placeholder="100"
                      />
                      {formErrors[`variant_${index}_stock`] && (
                        <p className={styles.fieldError}>{formErrors[`variant_${index}_stock`]}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className={styles.footerActions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={() => navigate("/admin/products")}
          >
            Cancel
          </button>

          <button type="submit" className={styles.saveButton}>
            {isEditMode ? "Save Changes" : "Create Product"}
          </button>
        </div>
      </form>

      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        title="Delete product"
        message="This will permanently delete the product and all its variants."
        confirmLabel="Delete"
        onConfirm={() => { setConfirmDeleteOpen(false); void handleDelete(); }}
        onCancel={() => setConfirmDeleteOpen(false)}
        variant="danger"
      />
    </div>
  );
}
