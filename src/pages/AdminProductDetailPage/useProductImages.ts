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

  const select = useCallback(
    (file: File): boolean => {
      if (!ALLOWED_EXTENSIONS.has(getExtension(file.name))) {
        showReminder({ message: "Only jpg, jpeg, png, and webp files are allowed." });
        return false;
      }
      if (displayedUrls.length + pendingFiles.length >= MAX_IMAGES) {
        showReminder({ message: `Maximum ${MAX_IMAGES} images allowed.` });
        return false;
      }
      setPendingFiles((prev) => [...prev, { file, previewUrl: URL.createObjectURL(file) }]);
      return true;
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
    flushDeletions,
    uploadFor,
  };
}
