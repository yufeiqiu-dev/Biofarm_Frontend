import { useCallback, useEffect, useRef } from "react";
import styles from "./ImageLightbox.module.css";

interface Props {
  images: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** Used for the alt text, so it says what is being looked at. */
  productName: string;
}

/**
 * The product image, full size.
 *
 * Worth having for this catalogue specifically: for an antibody the image is
 * the validation data - a western blot, a stained section - and the product
 * page renders it at 320px, where band positions cannot be read. Someone
 * deciding whether an antibody works in their application needs to look at the
 * actual evidence.
 *
 * Behaves like a dialog rather than merely looking like one: focus moves in and
 * is returned on close, Escape closes, the arrow keys move between images, and
 * the page behind cannot be scrolled or tabbed into.
 */
export function ImageLightbox({ images, index, onIndexChange, onClose, productName }: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const show = useCallback(
    (next: number) => onIndexChange((next + images.length) % images.length),
    [images.length, onIndexChange],
  );

  useEffect(() => {
    // Remember where focus was, so closing returns it to the thumbnail that
    // opened this rather than dumping the reader at the top of the document.
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") show(index + 1);
      if (event.key === "ArrowLeft") show(index - 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index, onClose, show]);

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={`${productName}, image ${index + 1} of ${images.length}`}
      // Clicking the backdrop closes, but a click that started on the image
      // must not - otherwise dragging to select or inspect it closes the view.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        ref={closeButtonRef}
        type="button"
        className={styles.close}
        onClick={onClose}
        aria-label="Close image viewer"
      >
        ✕
      </button>

      {images.length > 1 && (
        <button
          type="button"
          className={`${styles.step} ${styles.previous}`}
          onClick={() => show(index - 1)}
          aria-label="Previous image"
        >
          ‹
        </button>
      )}

      <figure className={styles.figure}>
        <img
          src={images[index]}
          alt={`${productName}, image ${index + 1} of ${images.length}`}
          className={styles.image}
        />
        {images.length > 1 && (
          <figcaption className={styles.caption}>
            {index + 1} of {images.length}
          </figcaption>
        )}
      </figure>

      {images.length > 1 && (
        <button
          type="button"
          className={`${styles.step} ${styles.next}`}
          onClick={() => show(index + 1)}
          aria-label="Next image"
        >
          ›
        </button>
      )}
    </div>
  );
}
