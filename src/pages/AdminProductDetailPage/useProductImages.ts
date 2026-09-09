import { useCallback, useEffect, useRef, useState } from "react";
import {
  confirmImageUpload,
  deleteImage,
  getImagePresignedUrl,
} from "../../api/admin_product";

export const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
export const MAX_IMAGES = 10;

export function getExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

interface PendingFile {
  file: File;
  /** A local blob URL, shown as a preview. Must be revoked or it leaks. */
  previewUrl: string;
}

/**
 * The product editor's images, which are the part of it that is genuinely
 * intricate.
 *
 * Nothing is written until Save, so three lists are in play at once:
 *
 *   savedUrls      what the database had when the product was last loaded
 *   displayedUrls  what the admin has arranged - deletions and reorders staged
 *   pendingFiles   chosen from disk, uploaded to nothing yet
 *
 * Deletions are worked out by comparing the first two at save time rather than
 * tracked as a list of operations, so no index bookkeeping can drift out of
 * step with what is on screen.
 *
 * The upload half cannot run until the product exists, because S3 keys are
 * scoped by product id - which is why a new product must be created first and
 * `uploadFor` takes the id rather than reading it from anywhere.
 */
export function useProductImages(showReminder: (r: { message: string }) => void) {
  const [displayedUrls, setDisplayedUrls] = useState<string[]>([]);
  const [savedUrls, setSavedUrls] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

  // Read through a ref by the unmount cleanup, so navigating away without
  // saving still revokes every preview rather than leaking them.
  const pendingFilesRef = useRef<PendingFile[]>([]);
  pendingFilesRef.current = pendingFiles;
  useEffect(() => {
    return () =>
      pendingFilesRef.current.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
  }, []);

  /** Adopt what the server has, as both the display order and the saved state. */
  const reset = useCallback((urls: string[]) => {
    setDisplayedUrls(urls);
    setSavedUrls(urls);
  }, []);

  /**
   * Queues one or more chosen files.
   *
   * Takes a list rather than a single file because the picker allows several at
   * once, and because the limit has to be counted against what this call is
   * itself adding - checking `pendingFiles.length` per file would let a
   * multi-select sail past the maximum, since that state does not update until
   * the batch is done.
   */
  const select = useCallback(
    (files: File[] | FileList) => {
      const chosen = Array.from(files);
      if (chosen.length === 0) return;

      const accepted: PendingFile[] = [];
      let room = MAX_IMAGES - (displayedUrls.length + pendingFiles.length);
      let rejectedType = false;
      let rejectedRoom = false;

      for (const file of chosen) {
        if (!ALLOWED_EXTENSIONS.has(getExtension(file.name))) {
          rejectedType = true;
          continue;
        }
        if (room <= 0) {
          rejectedRoom = true;
          continue;
        }
        accepted.push({ file, previewUrl: URL.createObjectURL(file) });
        room--;
      }

      // One message rather than one per file: selecting ten of the wrong thing
      // should not produce ten toasts.
      if (rejectedType) {
        showReminder({ message: "Only jpg, jpeg, png, and webp files are allowed." });
      }
      if (rejectedRoom) {
        showReminder({ message: `Maximum ${MAX_IMAGES} images allowed.` });
      }

      if (accepted.length > 0) {
        setPendingFiles((prev) => [...prev, ...accepted]);
      }
    },
    [displayedUrls.length, pendingFiles.length, showReminder],
  );

  const removePending = useCallback((index: number) => {
    setPendingFiles((prev) => {
      const url = prev[index]?.previewUrl;
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  /** Stages a deletion. The API call happens at save time. */
  const stageDeletion = useCallback((index: number) => {
    setDisplayedUrls((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const makePrimary = useCallback((index: number) => {
    setDisplayedUrls((prev) => [prev[index], ...prev.filter((_, i) => i !== index)]);
  }, []);

  /**
   * Swaps an image with its neighbour.
   *
   * "Set as primary" alone could technically reach any order - promote each
   * image in reverse - but nobody works that out, so in practice it only chose
   * the first image. Moving one step at a time is what makes an arbitrary order
   * actually achievable, and unlike dragging it works from the keyboard for
   * free.
   */
  const move = useCallback((index: number, delta: -1 | 1) => {
    setDisplayedUrls((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  /**
   * Moves an image to an arbitrary position.
   *
   * What dragging needs, where `move` only steps by one. Both end up in the
   * same array, so a drag and an arrow press are the same operation with
   * different arithmetic - there is no second ordering implementation to drift.
   */
  const reorder = useCallback((from: number, to: number) => {
    setDisplayedUrls((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  /**
   * The same for images chosen but not yet uploaded.
   *
   * They had no ordering controls at all - a fresh batch could only be arranged
   * by saving it first and then rearranging. They upload in this order and
   * append at the end, so the order set here is the order they land in.
   */
  const reorderPending = useCallback((from: number, to: number) => {
    setPendingFiles((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  /**
   * Deletes what the admin staged for removal.
   *
   * By URL rather than by index, so nothing has to stay in step with the order
   * on screen. savedUrls is synced afterwards so a retry does not re-send a URL
   * that is already gone.
   */
  const flushDeletions = useCallback(
    async (productId: string) => {
      const toDelete = savedUrls.filter((url) => !displayedUrls.includes(url));
      for (const url of toDelete) {
        await deleteImage(productId, url);
      }
      if (toDelete.length > 0) {
        setSavedUrls(displayedUrls);
      }
    },
    [savedUrls, displayedUrls],
  );

  /**
   * Presign, PUT, confirm - for each chosen file, against a product that now
   * exists.
   *
   * The count of successes is pruned from the queue in a `finally`, so a
   * failure halfway through leaves only the files that have not landed. Without
   * that, a retry re-uploads everything that already succeeded and the product
   * ends up with duplicates.
   */
  const uploadFor = useCallback(
    async (productId: string) => {
      if (pendingFiles.length === 0) return;

      let uploaded = 0;
      try {
        for (const { file, previewUrl } of pendingFiles) {
          const { upload_url, image_url } = await getImagePresignedUrl(
            productId,
            getExtension(file.name),
          );
          const response = await fetch(upload_url, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type },
          });
          if (!response.ok) {
            throw new Error(`Image upload failed (HTTP ${response.status})`);
          }
          await confirmImageUpload(productId, image_url);
          URL.revokeObjectURL(previewUrl);
          uploaded++;
        }
      } finally {
        if (uploaded > 0) {
          setPendingFiles((prev) => prev.slice(uploaded));
        }
      }
    },
    [pendingFiles],
  );

  return {
    displayedUrls,
    pendingFiles,
    /** How many saved images are staged for deletion but not yet deleted. */
    pendingDeletionCount: savedUrls.filter((u) => !displayedUrls.includes(u)).length,
    atLimit: displayedUrls.length + pendingFiles.length >= MAX_IMAGES,
    count: displayedUrls.length + pendingFiles.length,
    reset,
    select,
    removePending,
    stageDeletion,
    makePrimary,
    move,
    reorder,
    reorderPending,
    flushDeletions,
    uploadFor,
  };
}
