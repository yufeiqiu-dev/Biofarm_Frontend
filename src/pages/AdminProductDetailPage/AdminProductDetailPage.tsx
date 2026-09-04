import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LoadingOverlay } from "../../components/LoadingSpinner";
import {
  createProduct,
  deleteProduct,
  updateProduct,
  getImagePresignedUrl,
  confirmImageUpload,
  deleteImage,
} from "../../api/admin_product";
import { getProductById } from "../../api/product";
import { getAdminTags } from "../../api/admin_tag";
import type { Tag } from "../../types/tag_type";
import { useReminder } from "../../context/useReminder";
import { DEFAULT_PRODUCT_IMAGE } from "../../constants/product";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import styles from "./AdminProductDetailPage.module.css";

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

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const MAX_IMAGES = 10;

function getExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

export function AdminProductDetailPage() {
  const navigate = useNavigate();
  const { productId } = useParams();
  const { showReminder } = useReminder();
  const isEditMode = Boolean(productId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<AdminProductForm>(createEmptyForm());
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  // displayedUrls = confirmed in DB; savedUrls = DB state at last load/save
  const [displayedUrls, setDisplayedUrls] = useState<string[]>([]);
  const [savedUrls, setSavedUrls] = useState<string[]>([]);
  // pendingFiles = selected but not yet uploaded; previewUrl is a local blob URL
  const [pendingFiles, setPendingFiles] = useState<{ file: File; previewUrl: string }[]>([]);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Stores the product ID after a successful createProduct call, so a retry after
  // a partial upload failure reuses the same product instead of creating a duplicate.
  const [pendingProductId, setPendingProductId] = useState<string | undefined>(undefined);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Keep a ref to pendingFiles so the unmount cleanup can revoke all blob URLs
  // even when the user navigates away without saving.
  const pendingFilesRef = useRef<{ file: File; previewUrl: string }[]>([]);
  pendingFilesRef.current = pendingFiles;
  useEffect(() => {
    return () => pendingFilesRef.current.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
  }, []);

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
        const urls = product.image_urls ?? [];
        setDisplayedUrls(urls);
        setSavedUrls(urls);
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
  }, [isEditMode, productId]);

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
    const ext = getExtension(file.name);
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      showReminder({ message: "Only jpg, jpeg, png, and webp files are allowed." });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (displayedUrls.length + pendingFiles.length >= MAX_IMAGES) {
      showReminder({ message: `Maximum ${MAX_IMAGES} images allowed.` });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setPendingFiles((prev) => [...prev, { file, previewUrl: URL.createObjectURL(file) }]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemovePendingFile = (index: number) => {
    const url = pendingFiles[index]?.previewUrl;
    if (url) URL.revokeObjectURL(url);
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeleteImage = (index: number) => {
    // Stage the deletion — the API call happens on save
    setDisplayedUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSetPrimary = (index: number) => {
    setDisplayedUrls((prev) => [prev[index], ...prev.filter((_, i) => i !== index)]);
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
        // Flush staged deletions by URL — no index bookkeeping needed.
        const toDelete = savedUrls.filter((url) => !displayedUrls.includes(url));
        for (const url of toDelete) {
          await deleteImage(productId, url);
        }
        if (toDelete.length > 0) {
          // Sync savedUrls so a retry doesn't re-send already-deleted URLs.
          setSavedUrls(displayedUrls);
        }
        // Include the current display order so reordering is persisted.
        await updateProduct(productId, { ...payload, image_urls: displayedUrls });
      } else if (pendingProductId) {
        // Product was created in a previous attempt — just update it.
        await updateProduct(pendingProductId, payload);
      } else {
        const created = await createProduct(payload);
        setPendingProductId(created.id);
        targetId = created.id;
      }

      // Upload pending files now that we have a product ID.
      // Track how many succeed so a retry doesn't re-upload confirmed files.
      if (pendingFiles.length > 0 && targetId) {
        let uploadedCount = 0;
        try {
          for (const { file, previewUrl } of pendingFiles) {
            const ext = getExtension(file.name);
            const { upload_url, image_url } = await getImagePresignedUrl(targetId, ext);
            const uploadRes = await fetch(upload_url, {
              method: "PUT",
              body: file,
              headers: { "Content-Type": file.type },
            });
            if (!uploadRes.ok) throw new Error(`Image upload failed (HTTP ${uploadRes.status})`);
            await confirmImageUpload(targetId, image_url);
            URL.revokeObjectURL(previewUrl);
            uploadedCount++;
          }
        } finally {
          // Prune successfully uploaded files so a retry only re-sends the rest.
          if (uploadedCount > 0) {
            setPendingFiles((prev) => prev.slice(uploadedCount));
          }
        }
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

  if (loading || saving || deleting) {
    return <LoadingOverlay visible={true} />;
  }

  const pendingDeletionCount = savedUrls.filter((u) => !displayedUrls.includes(u)).length;

  return (
    <div className={styles.page}>
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
              <label className={styles.label}>Product Catalog ID</label>
              <input
                className={`${styles.input} ${formErrors.cat_id ? styles.inputError : ""}`}
                type="text"
                value={form.cat_id}
                onChange={(e) => handleFieldChange("cat_id", e.target.value)}
                placeholder="Enter base product catalog ID"
              />
              {formErrors.cat_id && <p className={styles.fieldError}>{formErrors.cat_id}</p>}
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Product Name</label>
              <input
                className={`${styles.input} ${formErrors.name ? styles.inputError : ""}`}
                type="text"
                value={form.name}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                placeholder="Enter product name"
              />
              {formErrors.name && <p className={styles.fieldError}>{formErrors.name}</p>}
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Description</label>
              <textarea
                className={`${styles.textarea} ${formErrors.description ? styles.inputError : ""}`}
                value={form.description}
                onChange={(e) => handleFieldChange("description", e.target.value)}
                placeholder="Enter product description"
                rows={6}
              />
              {formErrors.description && <p className={styles.fieldError}>{formErrors.description}</p>}
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Tags</label>
              {availableTags.length === 0 ? (
                <p style={{ fontSize: 13, color: "#9ca3af" }}>
                  No tags available. <a href="/admin/tags" style={{ color: "#16a34a" }}>Manage tags →</a>
                </p>
              ) : (
                <div className={styles.tagChips}>
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
                ({displayedUrls.length + pendingFiles.length}/{MAX_IMAGES})
              </span>
              {pendingDeletionCount > 0 && (
                <span style={{ fontSize: 12, fontWeight: 400, color: "#b45309", marginLeft: 8 }}>
                  {pendingDeletionCount} pending deletion
                </span>
              )}
            </h2>

            <div className={styles.fieldGroup}>
              <input
                ref={fileInputRef}
                className={styles.input}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                disabled={displayedUrls.length + pendingFiles.length >= MAX_IMAGES}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
              />
            </div>

            <div className={styles.imageGrid}>
              {displayedUrls.map((url, i) => (
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
                      onClick={() => handleSetPrimary(i)}
                      title="Set as primary"
                    >
                      ★
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.deleteImageButton}
                    onClick={() => handleDeleteImage(i)}
                  >
                    ×
                  </button>
                </div>
              ))}

              {pendingFiles.map(({ previewUrl }, i) => (
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
                    onClick={() => handleRemovePendingFile(i)}
                  >
                    ×
                  </button>
                </div>
              ))}

              {displayedUrls.length === 0 && pendingFiles.length === 0 && (
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

                  <div className={styles.variantGrid}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label}>Variant ID</label>
                      <input
                        className={styles.input}
                        type="text"
                        value={variant.id ?? ""}
                        disabled
                        placeholder="Auto-generated for new variants"
                      />
                    </div>

                    <div className={styles.fieldGroup}>
                      <label className={styles.label}>Catalog ID</label>
                      <input
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
                      <label className={styles.label}>Size Value</label>
                      <input
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
                      <label className={styles.label}>Size Unit</label>
                      <input
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
                      <label className={styles.label}>Price</label>
                      <input
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
                      <label className={styles.label}>Stock</label>
                      <input
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
