import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LoadingOverlay, PageLoading, useLoadingState } from "../../components/LoadingSpinner";
import {
  createProduct,
  deleteProduct,
  updateProduct,
} from "../../api/admin_product";
import { getProductById } from "../../api/product";
import { getAdminTags } from "../../api/admin_tag";
import type { Tag } from "../../types/tag_type";
import { useReminder } from "../../context/useReminder";
import { DEFAULT_PRODUCT_IMAGE } from "../../constants/product";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import styles from "./AdminProductDetailPage.module.css";
import { MAX_IMAGES, useProductImages } from "./useProductImages";
import { StockAdjustDialog } from "./StockAdjustDialog";
import { useProductForm } from "./useProductForm";
import { useDragReorder } from "./useDragReorder";

export function AdminProductDetailPage() {
  const navigate = useNavigate();
  const { productId } = useParams();
  const { showReminder } = useReminder();
  const isEditMode = Boolean(productId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    form,
    setForm,
    formErrors,
    handleFieldChange,
    handleVariantChange,
    handleAddVariant,
    handleRemoveVariant,
    handleToggleTag,
    validate,
  } = useProductForm(() => setSaveError(null));
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
  const load = useLoadingState(loading);
  const [saveError, setSaveError] = useState<string | null>(null);
  /*
   * Which variant is being adjusted, if any. The dialog owns everything
   * else about it - its inputs, its request, its errors.
   *
   * Separate from the form's deferred save because it writes immediately,
   * which is the whole point: deferring it would put the count back into a
   * payload written from a page rendered minutes ago.
   */
  const [restockingVariantId, setRestockingVariantId] = useState<string | null>(null);
  // Raised by the dialog while its request is in flight. The dialog disables
  // its own Cancel and backdrop, but these buttons sit outside it and stay
  // reachable by keyboard - and because the dialog is keyed by variant,
  // pressing one mid-request unmounts the instance waiting for an answer.
  const [adjustBusy, setAdjustBusy] = useState(false);

  const recordAdjustedStock = (variantId: string, stock: number) => {
    setForm((previous) => ({
      ...previous,
      // Matched on the variant's own id, not the row it was in. The dialog
      // is aria-modal but the page behind it is not inert, so a keyboard
      // user can tab out, remove a variant above this one, and tab back -
      // after which an index would point at a different row and the new
      // count would land on the wrong variant.
      variants: previous.variants.map((variant) =>
        variant.id === variantId ? { ...variant, stock: String(stock) } : variant,
      ),
    }));
  };

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
        setSaveError(
          error instanceof Error ? error.message : "Failed to load product."
        );
      } finally {
        setLoading(false);
      }
    };

    void loadProduct();
  // setForm is a useState setter and never changes identity, but it now
  // arrives from a custom hook where the linter cannot see that - and being
  // right by accident is not worth the suppression.
  }, [isEditMode, productId, resetImages, setForm]);

  const pendingFocus = useRef<string | null>(null);
  const imageGridRef = useRef<HTMLDivElement>(null);

  /*
   * Saved and pending images share one grid, so they share one index space:
   * pending tiles sit at savedCount + i.
   *
   * A drag that crosses between them is ignored rather than reinterpreted. A
   * chosen file has no URL until it has been uploaded, so it cannot take a
   * place among the saved ones - and silently dropping it back where it started
   * is more honest than appearing to move it and then not.
   */
  const drag = useDragReorder((from, to) => {
    const savedCount = images.displayedUrls.length;
    const bothSaved = from < savedCount && to < savedCount;
    const bothPending = from >= savedCount && to >= savedCount;

    if (bothSaved) images.reorder(from, to);
    else if (bothPending) images.reorderPending(from - savedCount, to - savedCount);
  }, imageGridRef);

  // Applied after the reorder renders, since the button to focus does not exist
  // under that label until then.
  useEffect(() => {
    const label = pendingFocus.current;
    if (!label) return;
    pendingFocus.current = null;
    imageGridRef.current
      ?.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
      ?.focus();
  }, [images.displayedUrls]);

  const handleFilesSelected = (files: FileList) => {
    images.select(files);
    // Cleared either way, so choosing the same file again still fires a change.
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /*
   * Moves an image and sends focus after it.
   *
   * The buttons are `disabled` at the ends and the item is keyed by url, so
   * React reuses the same DOM node: press "move earlier" twice and on the
   * second press the focused button becomes disabled under the cursor, the
   * browser blurs it, and focus falls back to <body> - the next Tab restarts
   * from the top of the document. So focus follows the image to its new
   * position, and turns around when it has reached the end.
   */
  const moveAndKeepFocus = (index: number, delta: -1 | 1) => {
    images.move(index, delta);

    const landed = index + delta;
    const stuck = delta === 1 ? landed === images.displayedUrls.length - 1 : landed === 0;
    const direction = stuck === (delta === 1) ? "earlier" : "later";
    pendingFocus.current = `Move image ${landed + 1} ${direction}`;
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validate()) {
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
          // Only for a variant being inserted, which has no count to adjust
          // yet. Sending it on an existing one is rejected by the server, and
          // for good reason: this payload was read before the admin started
          // typing, so it would overwrite whatever sold while the page was
          // open. Restocking goes through adjustVariantStock.
          ...(variant.id ? {} : { stock: Number(variant.stock) }),
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
        // Built separately, because create requires an opening count on every
        // variant and the shared payload only carries one where there is no id.
        // Nothing here has an id - the product does not exist yet - but that is
        // a fact about this branch, not something the shared shape can state.
        const created = await createProduct({
          ...payload,
          variants: form.variants.map((variant) => ({
            catalog_id: variant.catalog_id.trim(),
            size_value: Number(variant.size_value),
            size_unit: variant.size_unit.trim(),
            price: Number(variant.price),
            stock: Number(variant.stock),
          })),
        });
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
              // Every way off this page is shut while a stock request is in
              // flight, not just the dialog's own. The dialog has no focus trap
              // and the page behind it is not inert, so a keyboard admin can
              // tab out to any of these and leave - and unmounting the page
              // drops the adjustment's answer on the floor: no error, no
              // change, and every reason to think it worked.
              disabled={adjustBusy}
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
                // Several at once. Adding six images used to mean six separate
                // trips through the file picker.
                multiple
                disabled={images.atLimit}
                onChange={(e) => {
                  if (e.target.files?.length) handleFilesSelected(e.target.files);
                }}
              />
            </div>

            <div className={styles.imageGrid} ref={imageGridRef}>
              {images.displayedUrls.map((url, i) => (
                <div
                  key={url}
                  className={`${styles.imageItem} ${
                    drag.draggingIndex === i ? styles.imageItemDragging : ""
                  }`}
                  {...drag.tileProps(i)}
                >
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
                      aria-label={`Make image ${i + 1} the primary image`}
                    >
                      ★
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.deleteImageButton}
                    onClick={() => images.stageDeletion(i)}
                    aria-label={`Remove image ${i + 1}`}
                  >
                    ×
                  </button>

                  {/*
                    One step at a time. "Set as primary" could in principle reach
                    any order - promote each image in reverse - but nobody works
                    that out, so in practice it only ever chose the first image.
                    Buttons rather than dragging, because these work from the
                    keyboard without a second implementation.
                  */}
                  <div className={styles.moveControls}>
                    <button
                      type="button"
                      className={styles.moveButton}
                      onClick={() => moveAndKeepFocus(i, -1)}
                      disabled={i === 0}
                      aria-label={`Move image ${i + 1} earlier`}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className={styles.moveButton}
                      onClick={() => moveAndKeepFocus(i, 1)}
                      disabled={i === images.displayedUrls.length - 1}
                      aria-label={`Move image ${i + 1} later`}
                    >
                      ›
                    </button>
                  </div>
                </div>
              ))}

              {images.pendingFiles.map(({ previewUrl }, i) => (
                <div
                  key={previewUrl}
                  className={`${styles.imageItem} ${
                    drag.draggingIndex === images.displayedUrls.length + i
                      ? styles.imageItemDragging
                      : ""
                  }`}
                  {...drag.tileProps(images.displayedUrls.length + i)}
                >
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
                            onClick={() => setRestockingVariantId(variant.id!)}
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
                            handleVariantChange(index, "stock", e.target.value)
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

        <div className={styles.footerActions}>
          <button
            type="button"
            className={styles.cancelButton}
            disabled={adjustBusy}
            onClick={() => navigate("/admin/products")}
          >
            Cancel
          </button>

          <button type="submit" className={styles.saveButton} disabled={adjustBusy}>
            {isEditMode ? "Save Changes" : "Create Product"}
          </button>
        </div>
      </form>

      {restockingVariantId !== null && (
        <StockAdjustDialog
          // Keyed by the variant, so switching between them remounts rather
          // than rebinding. Without it React reconciles the same instance and
          // its delta, reason and error survive the change - and the page
          // behind is not inert and has no focus trap, so an admin can tab from
          // this dialog to another variant's Adjust button and press Enter.
          // That is exactly the carry-over the extraction was meant to make
          // impossible, and moving the state into the component did not on its
          // own achieve it.
          key={restockingVariantId}
          productId={productId!}
          variantId={restockingVariantId}
          onAdjusted={recordAdjustedStock}
          onBusyChange={setAdjustBusy}
          onClose={() => setRestockingVariantId(null)}
        />
      )}


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
