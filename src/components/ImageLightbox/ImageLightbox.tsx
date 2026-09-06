import { useCallback, useEffect, useRef } from "react";
import { DEFAULT_PRODUCT_IMAGE } from "../../constants/product";
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
 * Behaves like a dialog rather than merely looking like one: focus moves in, is
 * kept inside while it is open, and is returned on close; Escape closes; the
 * arrow keys move between images; and the page behind cannot be scrolled.
 */
export function ImageLightbox({ images, index, onIndexChange, onClose, productName }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);
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

      // Keep Tab inside. aria-modal tells a screen reader the rest of the page
      // is inert, but it does nothing for a sighted keyboard user, who would
      // otherwise tab straight past the last arrow into the variant radios and
      // "Add to cart" hidden behind the backdrop - activating a control they
      // cannot see. Every focusable thing in here is a button, so this does not
      // need the general focusable-selector incantation.
      if (event.key !== "Tab" || !backdropRef.current) return;
      const buttons = backdropRef.current.querySelectorAll<HTMLElement>("button");
      if (buttons.length === 0) return;

      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      const active = document.activeElement;
      const inside = backdropRef.current.contains(active);

      if (event.shiftKey && (active === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index, onClose, show]);

  return (
    <div
      ref={backdropRef}
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
          // The page image behind falls back the same way. Without this the
          // shopper sees a normal placeholder, clicks it, and gets a broken
          // glyph on a near-black backdrop - which reads as the viewer being
          // broken rather than the image being missing.
          onError={(event) => {
            if (event.currentTarget.src.endsWith(DEFAULT_PRODUCT_IMAGE)) return;
            event.currentTarget.src = DEFAULT_PRODUCT_IMAGE;
          }}
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
