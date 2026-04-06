import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import styles from "./AdminProductDetailPage.module.css";

type AdminVariantForm = {
  id: string;
  catalog_id: string;
  size_value: string;
  size_unit: string;
  price: string;
  stock: string;
};

type AdminProductForm = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  variants: AdminVariantForm[];
};

const createEmptyVariant = (): AdminVariantForm => ({
  id: "",
  catalog_id: "",
  size_value: "",
  size_unit: "",
  price: "",
  stock: "",
});

export function AdminProductDetailPage() {
  const navigate = useNavigate();
  const { productId } = useParams();

  const isEditMode = Boolean(productId);

  const [form, setForm] = useState<AdminProductForm>({
    id: productId ?? "",
    name: "",
    description: "",
    imageUrl: "",
    variants: [createEmptyVariant()],
  });

  const [imageFile, setImageFile] = useState<File | null>(null);

  const imagePreviewUrl = useMemo(() => {
    if (imageFile) {
      return URL.createObjectURL(imageFile);
    }
    return form.imageUrl || "";
  }, [imageFile, form.imageUrl]);

  const handleFieldChange = (
    field: keyof Omit<AdminProductForm, "variants">,
    value: string
  ) => {
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
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((variant, i) =>
        i === index ? { ...variant, [field]: value } : variant
      ),
    }));
  };

  const handleAddVariant = () => {
    setForm((prev) => ({
      ...prev,
      variants: [...prev.variants, createEmptyVariant()],
    }));
  };

  const handleRemoveVariant = (index: number) => {
    setForm((prev) => ({
      ...prev,
      variants:
        prev.variants.length === 1
          ? prev.variants
          : prev.variants.filter((_, i) => i !== index),
    }));
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      // TODO:
      // 1. upload imageFile if present
      // 2. build request body
      // 3. call create or update API

      const payload = {
        ...form,
        variants: form.variants.map((variant) => ({
          ...variant,
          size_value: Number(variant.size_value),
          price: Number(variant.price),
          stock: Number(variant.stock),
        })),
      };

      console.log("Saving product:", payload);
      console.log("Image file:", imageFile);

      navigate("/admin/products");
    } catch (error) {
      console.error("Failed to save product", error);
    }
  };

  const handleDelete = async () => {
    if (!isEditMode) return;

    const confirmed = window.confirm("Delete this product?");
    if (!confirmed) return;

    try {
      // TODO: call delete API with productId
      console.log("Deleting product:", productId);
      navigate("/admin/products");
    } catch (error) {
      console.error("Failed to delete product", error);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {isEditMode ? "Edit Product" : "Add Product"}
          </h1>
          <p className={styles.subtitle}>
            {isEditMode
              ? "Update product information, image, and variants."
              : "Create a new product and add its variants."}
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
        <div className={styles.mainGrid}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Basic Information</h2>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Product ID</label>
              <input
                className={styles.input}
                type="text"
                value={form.id}
                onChange={(e) => handleFieldChange("id", e.target.value)}
                placeholder="Enter product id"
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
                onChange={handleImageFileChange}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Image URL</label>
              <input
                className={styles.input}
                type="text"
                value={form.imageUrl}
                onChange={(e) => handleFieldChange("imageUrl", e.target.value)}
                placeholder="Or paste image URL"
              />
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

          <div className={styles.variantList}>
            {form.variants.map((variant, index) => (
              <div key={index} className={styles.variantCard}>
                <div className={styles.variantCardHeader}>
                  <h3 className={styles.variantTitle}>Variant {index + 1}</h3>
                  {form.variants.length > 1 && (
                    <button
                      type="button"
                      className={styles.removeVariantButton}
                      onClick={() => handleRemoveVariant(index)}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className={styles.variantGrid}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Variant ID</label>
                    <input
                      className={styles.input}
                      type="text"
                      value={variant.id}
                      onChange={(e) =>
                        handleVariantChange(index, "id", e.target.value)
                      }
                      placeholder="Enter variant id"
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
                      placeholder="Enter catalog id"
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