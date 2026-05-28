import { useEffect, useMemo, useRef, useState } from "react";
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
import { useReminder } from "../../context/ReminderContext";
import { DEFAULT_PRODUCT_IMAGE } from "../../constants/product";
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

function validateForm(form: AdminProductForm): string[] {
  const errors: string[] = [];

  if (!form.cat_id.trim()) {
    errors.push("Product catalog ID is required.");
  }

  if (!form.name.trim()) {
    errors.push("Product name is required.");
  }

  if (!form.description.trim()) {
    errors.push("Product description is required.");
  }

  form.variants.forEach((variant, index) => {
    const label = `Variant ${index + 1}`;

    if (!variant.catalog_id.trim()) {
      errors.push(`${label}: catalog ID is required.`);
    }

    if (!variant.size_value.trim()) {
      errors.push(`${label}: size value is required.`);
    } else if (Number(variant.size_value) <= 0) {
      errors.push(`${label}: size value must be greater than 0.`);
    }

    if (!variant.size_unit.trim()) {
      errors.push(`${label}: size unit is required.`);
    }

    if (!variant.price.trim()) {
      errors.push(`${label}: price is required.`);
    } else if (Number(variant.price) < 0) {
      errors.push(`${label}: price cannot be negative.`);
    }

    if (!variant.stock.trim()) {
      errors.push(`${label}: stock is required.`);
    } else if (Number(variant.stock) < 0) {
      errors.push(`${label}: stock cannot be negative.`);
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
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

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
        setImageUrls(product.image_urls ?? []);
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

  const clearErrors = () => {
    if (formErrors.length > 0) setFormErrors([]);
    if (saveError) setSaveError(null);
  };

  const handleFieldChange = (
    field: keyof AdminProductForm,
    value: string
  ) => {
    clearErrors();
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleVariantChange = (
    index: number,
    field: keyof AdminVariantForm,
    value: string
  ) => {
    clearErrors();
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((variant, i) =>
        i === index ? { ...variant, [field]: value } : variant
      ),
    }));
  };

  const handleAddVariant = () => {
    clearErrors();
    setForm((prev) => ({ ...prev, variants: [...prev.variants, createEmptyVariant()] }));
  };

  const handleRemoveVariant = (index: number) => {
    clearErrors();
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }));
  };

  const handleToggleTag = (tagId: string) => {
    setForm((prev) => ({
      ...prev,
      tag_ids: prev.tag_ids.includes(tagId)
        ? prev.tag_ids.filter((id) => id !== tagId)
        : [...prev.tag_ids, tagId],
    }));
  };

  const handleImageUpload = async (file: File) => {
    if (!productId) {
      showReminder({ message: "Save the product first before uploading images." });
      return;
    }

    const ext = getExtension(file.name);
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      showReminder({ message: "Only jpg, jpeg, png, and webp files are allowed." });
      return;
    }

    if (imageUrls.length >= MAX_IMAGES) {
      showReminder({ message: `Maximum ${MAX_IMAGES} images allowed.` });
      return;
    }

    try {
      setUploadingImage(true);

      const { upload_url, image_url } = await getImagePresignedUrl(productId, ext);

      await fetch(upload_url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      const result = await confirmImageUpload(productId, image_url);
      setImageUrls(result.image_urls);
    } catch (error) {
      console.error("Image upload failed", error);
      showReminder({ message: error instanceof Error ? error.message : "Image upload failed." });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteImage = async (index: number) => {
    if (!productId) return;

    try {
      await deleteImage(productId, index + 1); // API uses 1-based index
      setImageUrls((prev) => prev.filter((_, i) => i !== index));
    } catch (error) {
      console.error("Failed to delete image", error);
      showReminder({ message: "Failed to delete image." });
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const errors = validateForm(form);
    if (errors.length > 0) {
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

      if (isEditMode && productId) {
        await updateProduct(productId, payload);
      } else {
        await createProduct(payload);
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

    const confirmed = window.confirm("Delete this product?");
    if (!confirmed) return;

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
              onClick={handleDelete}
            >
              Delete Product
            </button>
          )}
        </div>
      </div>

      <form className={styles.form} onSubmit={handleSave}>
        {(formErrors.length > 0 || saveError) && (
          <div
            style={{
              marginBottom: 16,
              padding: "12px 16px",
              border: "1px solid #f3b4b4",
              background: "#fff3f3",
              borderRadius: 8,
            }}
          >
            {saveError && (
              <p style={{ color: "#b42318", margin: 0, marginBottom: formErrors.length ? 8 : 0 }}>
                {saveError}
              </p>
            )}

            {formErrors.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {formErrors.map((error) => (
                  <li key={error} style={{ color: "#b42318" }}>
                    {error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className={styles.mainGrid}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Basic Information</h2>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Product Catalog ID</label>
              <input
                className={styles.input}
                type="text"
                value={form.cat_id}
                onChange={(e) => handleFieldChange("cat_id", e.target.value)}
                placeholder="Enter base product catalog ID"
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Product Name</label>
              <input
                className={styles.input}
                type="text"
                value={form.name}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                placeholder="Enter product name"
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Description</label>
              <textarea
                className={styles.textarea}
                value={form.description}
                onChange={(e) => handleFieldChange("description", e.target.value)}
                placeholder="Enter product description"
                rows={6}
              />
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
                ({imageUrls.length}/{MAX_IMAGES})
              </span>
            </h2>

            {!isEditMode && (
              <p style={{ fontSize: 13, color: "#667085", marginBottom: 12 }}>
                Save the product first, then upload images.
              </p>
            )}

            {isEditMode && (
              <>
                <div className={styles.fieldGroup}>
                  <input
                    ref={fileInputRef}
                    className={styles.input}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    disabled={uploadingImage || imageUrls.length >= MAX_IMAGES}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleImageUpload(file);
                    }}
                  />
                  {uploadingImage && (
                    <p style={{ marginTop: 6, fontSize: 13, color: "#6366f1" }}>
                      Uploading...
                    </p>
                  )}
                </div>

                <div className={styles.imageGrid}>
                  {imageUrls.map((url, i) => (
                    <div key={i} className={styles.imageItem}>
                      <img
                        src={url}
                        alt={`Product image ${i + 1}`}
                        className={styles.imageThumb}
                      />
                      {i === 0 && (
                        <span className={styles.primaryBadge}>Primary</span>
                      )}
                      <button
                        type="button"
                        className={styles.deleteImageButton}
                        onClick={() => void handleDeleteImage(i)}
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {imageUrls.length === 0 && (
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
              </>
            )}
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
                        className={styles.input}
                        type="text"
                        value={variant.catalog_id}
                        onChange={(e) =>
                          handleVariantChange(index, "catalog_id", e.target.value)
                        }
                        placeholder="Enter catalog ID"
                      />
                    </div>

                    <div className={styles.fieldGroup}>
                      <label className={styles.label}>Size Value</label>
                      <input
                        className={styles.input}
                        type="number"
                        value={variant.size_value}
                        onChange={(e) =>
                          handleVariantChange(index, "size_value", e.target.value)
                        }
                        placeholder="10"
                      />
                    </div>

                    <div className={styles.fieldGroup}>
                      <label className={styles.label}>Size Unit</label>
                      <input
                        className={styles.input}
                        type="text"
                        value={variant.size_unit}
                        onChange={(e) =>
                          handleVariantChange(index, "size_unit", e.target.value)
                        }
                        placeholder="mL"
                      />
                    </div>

                    <div className={styles.fieldGroup}>
                      <label className={styles.label}>Price</label>
                      <input
                        className={styles.input}
                        type="number"
                        step="0.01"
                        value={variant.price}
                        onChange={(e) =>
                          handleVariantChange(index, "price", e.target.value)
                        }
                        placeholder="99.99"
                      />
                    </div>

                    <div className={styles.fieldGroup}>
                      <label className={styles.label}>Stock</label>
                      <input
                        className={styles.input}
                        type="number"
                        value={variant.stock}
                        onChange={(e) =>
                          handleVariantChange(index, "stock", e.target.value)
                        }
                        placeholder="100"
                      />
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
    </div>
  );
}
