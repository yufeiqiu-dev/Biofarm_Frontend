import { useState } from "react";

/**
 * The product editor's form state, its validation, and the handlers that edit
 * it.
 *
 * Split out because the page had grown to hold four separate concerns at once -
 * this, the image staging (useProductImages), the stock adjustment
 * (StockAdjustDialog) and the save sequence - and only the save sequence
 * genuinely has to live alongside the rendering, because its ordering is the
 * subtle part.
 *
 * Deliberately knows nothing about saving, images or the API. It owns what the
 * admin has typed and whether it is valid, and that is all.
 */

export type AdminVariantForm = {
  id?: string;
  catalog_id: string;
  size_value: string;
  size_unit: string;
  price: string;
  stock: string;
};

export type AdminProductForm = {
  cat_id: string;
  name: string;
  description: string;
  tag_ids: string[];
  variants: AdminVariantForm[];
};

export const createEmptyVariant = (): AdminVariantForm => ({
  id: undefined,
  catalog_id: "",
  size_value: "",
  size_unit: "",
  price: "",
  stock: "",
});

export const createEmptyForm = (): AdminProductForm => ({
  cat_id: "",
  name: "",
  description: "",
  tag_ids: [],
  variants: [],
});

export function validateForm(form: AdminProductForm): Record<string, string> {
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
    // Only a new variant carries an opening count; an existing one's stock is
    // not editable here at all.
    if (!variant.id) {
      if (!variant.stock.trim()) {
        errors[`variant_${index}_stock`] = "Stock is required.";
      } else if (Number(variant.stock) < 0) {
        errors[`variant_${index}_stock`] = "Stock cannot be negative.";
      }
    }
  });

  return errors;
}

export function useProductForm(
  /**
   * Called whenever the admin edits anything.
   *
   * The page uses it to clear a failed save's message: a save error describes a
   * request that has since been superseded by whatever is being typed now, and
   * leaving it up makes the form look broken while it is being fixed.
   */
  onEdited: () => void,
) {
  const [form, setForm] = useState<AdminProductForm>(createEmptyForm());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  /** Clears one field's error as it is corrected, rather than at next submit. */
  const clearError = (key: string) => {
    setFormErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  const handleFieldChange = (field: keyof AdminProductForm, value: string) => {
    clearError(field);
    onEdited();
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleVariantChange = (
    index: number,
    field: keyof AdminVariantForm,
    value: string,
  ) => {
    clearError(`variant_${index}_${field}`);
    onEdited();
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((variant, i) =>
        i === index ? { ...variant, [field]: value } : variant,
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
    // Errors are keyed by position, so removing a variant has to renumber the
    // ones after it. Without this, deleting the first of three variants left
    // the second one wearing the third one's error.
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

  /** Validates, stores the errors for rendering, and says whether it passed. */
  const validate = (): boolean => {
    const errors = validateForm(form);
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  return {
    form,
    setForm,
    formErrors,
    handleFieldChange,
    handleVariantChange,
    handleAddVariant,
    handleRemoveVariant,
    handleToggleTag,
    validate,
  };
}
