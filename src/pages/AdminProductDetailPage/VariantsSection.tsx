import type { AdminProductForm, AdminVariantForm } from "./useProductForm";
import styles from "./AdminProductDetailPage.module.css";

/**
 * The variants list: sizes, prices, and each variant's stock readout.
 *
 * A section rather than a page concern. Stock is the part worth knowing about:
 * for a variant that already exists it is displayed, never edited, because this
 * form is a read-modify-write over the whole product and the count it was
 * rendered with is stale the moment anything sells. Adjusting goes through the
 * dialog the page owns, which sends a change rather than a value.
 */
export function VariantsSection({
  form,
  formErrors,
  adjustBusy,
  onVariantChange,
  onAddVariant,
  onRemoveVariant,
  onAdjustStock,
}: {
  form: AdminProductForm;
  formErrors: Record<string, string>;
  /** True while a stock adjustment is in flight, which shuts every way off the page. */
  adjustBusy: boolean;
  onVariantChange: (index: number, field: keyof AdminVariantForm, value: string) => void;
  onAddVariant: () => void;
  onRemoveVariant: (index: number) => void;
  onAdjustStock: (variantId: string) => void;
}) {
  return (
        <section className={styles.section}>
          <div className={styles.variantHeader}>
            <h2 className={styles.sectionTitle}>Variants</h2>
            <button
              type="button"
              className={styles.addVariantButton}
              onClick={onAddVariant}
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
                      onClick={() => onRemoveVariant(index)}
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
                          onVariantChange(index, "catalog_id", e.target.value)
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
                          onVariantChange(index, "size_value", e.target.value)
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
                          onVariantChange(index, "size_unit", e.target.value)
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
                          onVariantChange(index, "price", e.target.value)
                        }
                        placeholder="99.99"
                      />
                      {formErrors[`variant_${index}_price`] && (
                        <p className={styles.fieldError}>{formErrors[`variant_${index}_price`]}</p>
                      )}
                    </div>

                    {/*
                      Stock is editable only while the variant is being created.
                      Once it exists the number is the shelf, and this form
                      cannot be trusted to carry it: the page was rendered
                      before the admin started typing, so saving would overwrite
                      every sale made in between. Restocking applies a change
                      instead - see the Restock control below.
                    */}
                    <div className={styles.fieldGroup}>
                      {variant.id ? (
                        // No htmlFor: the readout is a span and a button, so it
                        // pointed at an id nothing rendered - a dead click and
                        // an orphaned label for a screen reader.
                        <span className={styles.label} id={`product-stock-label-${index}`}>
                          Available (not reserved)
                          {/*
                            Named per variant. Every row's label read the same,
                            so a screen reader on a three-variant product
                            announced "Available (not reserved) 4 … Available
                            (not reserved) 12" with nothing tying either number
                            to a variant - the complaint the Adjust button's
                            label was added to fix, still true of the count it
                            labels.
                          */}
                          {variant.catalog_id ? ` — ${variant.catalog_id}` : ""}
                        </span>
                      ) : (
                        <label className={styles.label} htmlFor={`product-stock-${index}`}>
                          Opening stock
                        </label>
                      )}
                      {variant.id ? (
                        <div className={styles.stockReadout}>
                          {/*
                            <output>, not a <span>. aria-labelledby on a bare
                            span leaves the name uncomputed by assistive tech, so
                            a screen reader announced a naked "4" - the same
                            outcome as the orphaned label it replaced.
                          */}
                          <output
                            className={styles.stockCount}
                            aria-labelledby={`product-stock-label-${index}`}
                          >
                            {variant.stock}
                          </output>
                          <button
                            type="button"
                            className={styles.stockButton}
                            // Named by its variant. With more than one, every
                            // row rendered a button called just "Adjust", so
                            // they were indistinguishable by name - to a screen
                            // reader, and to getByRole in a test.
                            aria-label={`Adjust stock for ${variant.catalog_id || "this variant"}`}
                            // Nothing to reset here: the dialog is keyed by
                            // variant, so it is a fresh instance for each one
                            // and cannot carry the last attempt's delta or
                            // error across - which it did, when this page held
                            // that state and only some of the ways out cleared
                            // it.
                            disabled={adjustBusy}
                            onClick={() => onAdjustStock(variant.id!)}
                          >
                            Adjust
                          </button>
                        </div>
                      ) : (
                        <input
                          id={`product-stock-${index}`}
                          className={`${styles.input} ${formErrors[`variant_${index}_stock`] ? styles.inputError : ""}`}
                          type="number"
                          value={variant.stock}
                          onChange={(e) =>
                            onVariantChange(index, "stock", e.target.value)
                          }
                          placeholder="100"
                        />
                      )}
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
  );
}
