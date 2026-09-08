import { useState } from "react";
import { adjustVariantStock } from "../../api/admin_product";
import styles from "./AdminProductDetailPage.module.css";

/**
 * Adjusts one variant's stock by a signed amount.
 *
 * Owns its own state and makes its own request, deliberately. Stock is the one
 * thing on this page that is not part of the form's deferred save, and keeping
 * it here is what stops that boundary blurring: deferring the change to Save
 * would put the count back into a payload written from a page rendered minutes
 * ago, which is the overwrite the whole feature replaced.
 *
 * A change, never a new value. "Set stock to 40" would be the same overwrite in
 * a smaller box - the 40 would be reasoned from a number that was already stale
 * by the time it was read.
 */
export function StockAdjustDialog({
  productId,
  variantId,
  onAdjusted,
  onBusyChange,
  onClose,
}: {
  productId: string;
  variantId: string;
  /** The count the server came back with, for the caller to store. */
  onAdjusted: (variantId: string, stock: number) => void;
  /**
   * Raised while a request is in flight, so the page can shut the other ways
   * out.
   *
   * Cancel and the backdrop are disabled here, but the page's other Adjust
   * buttons are not covered by this dialog and are still reachable by keyboard.
   * Switching variants remounts this component - it is keyed - which unmounts
   * an in-flight request, so its rejection lands on a dead component and is
   * dropped: no error, no change, and every reason to think it worked. That is
   * the hole the busy guard exists to close, and the page owns the last door.
   */
  onBusyChange: (busy: boolean) => void;
  onClose: () => void;
}) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    const amount = Number(delta);
    // Whole units. The input is a bare type="number" outside any form, so no
    // constraint validation runs and "2.5" reached the server, where pydantic
    // refused it and the admin read "Input should be a valid integer".
    if (!delta.trim() || !Number.isInteger(amount) || amount === 0) {
      setError("Enter a whole number of units to add, or a negative one to remove.");
      return;
    }

    setBusy(true);
    onBusyChange(true);
    setError(null);
    try {
      const updated = await adjustVariantStock(productId, variantId, amount, reason);
      // The server's count, not ours plus the delta. It applied the change to
      // whatever was actually there, which is the reason this is not a form
      // field - anything sold while the page was open is already in it.
      onAdjusted(variantId, updated.stock);
      onClose();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Could not adjust stock.",
      );
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  };

  return (
    <div
      className={styles.restockBackdrop}
      // Not while a request is in flight. Closing then left the rejection -
      // "Cannot remove 5 from a stock of 2" - written into state that nothing
      // renders, so the admin saw no error, the count was unchanged, and the
      // only reasonable conclusion was that it had worked.
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className={styles.restockDialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="restock-title"
      >
        <h2 id="restock-title" className={styles.restockTitle}>Adjust stock</h2>
        <p className={styles.restockBody}>
          How many units arrived? Use a negative number for breakage or a
          miscount. This is added to the current figure, so anything sold while
          this page was open is already accounted for.
          <br />
          <strong>Not a physical count.</strong> Open orders have already taken
          their units out of this number, so boxes still on the shelf may be
          spoken for - entering the difference would sell them twice.
        </p>
        <label className={styles.label} htmlFor="restock-delta">
          Units to add or remove
        </label>
        <input
          id="restock-delta"
          className={styles.input}
          aria-describedby={error ? "restock-error" : undefined}
          type="number"
          step="1"
          value={delta}
          autoFocus
          onChange={(e) => setDelta(e.target.value)}
          placeholder="12"
        />
        <label className={styles.label} htmlFor="restock-reason">
          Reason <span className={styles.optional}>(optional)</span>
        </label>
        <input
          id="restock-reason"
          className={styles.input}
          type="text"
          maxLength={200}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Delivery 4471, or breakage"
        />
        {/*
          role="alert", because nothing else announces this. Blocking dismissal
          while the request is in flight closed the "no feedback, so assume it
          worked" hole for a sighted admin; without this the same hole stays
          open on the audio channel, and making the count an <output> sharpened
          it - the success now speaks and the refusal stayed silent.
        */}
        {error && (
          <p id="restock-error" className={styles.fieldError} role="alert">
            {error}
          </p>
        )}
        <div className={styles.restockActions}>
          <button
            type="button"
            className={styles.cancelButton}
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.saveButton}
            disabled={busy}
            onClick={() => void apply()}
          >
            {busy ? "Saving…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
