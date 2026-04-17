import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LoadingOverlay } from "../../components/LoadingSpinner";
import { createProduct, deleteProduct, updateProduct } from "../../api/admin_product";
import { getProductById } from "../../api/product";
import { useReminder } from "../../context/ReminderContext"; 
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
  image_url: string;
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
  image_url: "",
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

export function AdminProductDetailPage() {
  const navigate = useNavigate();
  const { productId } = useParams();
  const { showReminder } = useReminder();
  const isEditMode = Boolean(productId);

  const [form, setForm] = useState<AdminProductForm>(createEmptyForm());
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

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
          image_url: product.image_url ?? "",
          variants: (product.variants ?? []).map((variant) => ({
            id: variant.id,
            catalog_id: variant.catalog_id,
            size_value: String(variant.size_value),
            size_unit: variant.size_unit,
            price: String(variant.price),
            stock: String(variant.stock),
          })),
        });
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

  const imagePreviewUrl = useMemo(() => {
    if (selectedImageFile) {
      return URL.createObjectURL(selectedImageFile);
    }

    return form.image_url.trim();
  }, [form.image_url, selectedImageFile]);

  useEffect(() => {
    return () => {
      if (selectedImageFile && imagePreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl, selectedImageFile]);

  const clearErrors = () => {
    if (formErrors.length > 0) setFormErrors([]);
    if (saveError) setSaveError(null);
  };

  const handleFieldChange = (
    field: keyof Omit<AdminProductForm, "variants">,
    value: string
  ) => {
    clearErrors();
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
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
    setForm((prev) => ({
      ...prev,
      variants: [...prev.variants, createEmptyVariant()],
    }));
  };

  const handleRemoveVariant = (index: number) => {
    clearErrors();
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }));
  };

  const handleImageFileChange = (file: File | null) => {
    clearErrors();
    setSelectedImageFile(file);
  };

  const handleClearImage = () => {
    clearErrors();
    setSelectedImageFile(null);
    setForm((prev) => ({
      ...prev,
      image_url: "",
    }));
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const errors = validateForm(form);
    if (errors.length > 0) {
      setFormErrors(errors);
      showReminder({message: "Please fix errors in the form!"})
      return;
    }

    try {
      setSaving(true);
      setSaveError(null);

      const payload = {
        cat_id: form.cat_id.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        image_url: form.image_url.trim() || null,
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
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Product Image</h2>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Upload Image</label>
              <input
                className={styles.input}
                type="file"
                accept="image/*"
                onChange={(e) => handleImageFileChange(e.target.files?.[0] ?? null)}
              />
              <p style={{ marginTop: 8, fontSize: 13, color: "#667085" }}>
                File upload is preview-only for now. To persist an image before S3
                is implemented, use the Image URL field below.
              </p>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Image URL</label>
              <input
                className={styles.input}
                type="text"
                value={form.image_url}
                onChange={(e) => handleFieldChange("image_url", e.target.value)}
                placeholder="Paste image URL"
              />
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={handleClearImage}
              >
                Clear Image
              </button>
            </div>

            <div className={styles.previewBox}>
              {imagePreviewUrl ? (
                <img
                  src={imagePreviewUrl}
                  alt="Product preview"
                  className={styles.previewImage}
                />
              ) : (
                <span className={styles.previewPlaceholder}>
                  Image preview will appear here
                </span>
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
              No variants yet. Click “Add Variant” to create one.
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