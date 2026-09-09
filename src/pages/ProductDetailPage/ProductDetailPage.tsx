import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DEFAULT_PRODUCT_IMAGE } from "../../constants/product";
import styles from "./ProductDetailPage.module.css";
import { getProductById } from "../../api/product";
import { ApiError } from "../../api/client";
import type { Product } from "../../types/product_type";
import type { AddToCartItem } from "../../types/cart_types";
import { AddToCartButton } from "../../components/AddToCartButton";
import { ImageLightbox } from "../../components/ImageLightbox";
import { PageLoading, useLoadingState } from "../../components/LoadingSpinner";
import {
  formatPriceSpan,
  variantStock,
} from "../../components/ProductCard/productSummary";

export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null,
  );
  const [quantity, setQuantity] = useState(1);
  const load = useLoadingState(loading);

  useEffect(() => {
    if (!productId) {
      setProduct(null);
      setLoading(false);
      return;
    }

    /*
     * Answers from a product we have navigated away from are discarded.
     *
     * Clearing the flag as each load starts fixes the sequential case but not
     * the overlapping one: click A then B straight away, B clears the flag and
     * starts its fetch, A's request then 500s and its catch sets the flag on
     * B's page - "It is a fault on our side" over a product that loaded
     * perfectly, and stuck there until the next navigation.
     */
    let cancelled = false;

    const loadProduct = async () => {
      try {
        setLoading(true);
        // Cleared as each load starts, not only when one fails. React Router
        // keeps this component mounted across /products/:id changes, so the
        // flag survived the param change: one transient 500 on product A left
        // every product opened afterwards claiming the fault was ours, until a
        // full reload. The cart sidebar links straight to other products, so
        // that is one click away.
        setLoadFailed(false);
        const p = await getProductById(productId);
        if (cancelled) return;
        setProduct(p);
      } catch (error) {
        // A 404 is a missing product; anything else is our failure and must not
        // be reported as one. Collapsing both into setProduct(null) meant a
        // backend outage rendered "Product not found." on every product page -
        // a confident, wrong answer, and one that reads identically to a
        // genuine deletion in a customer's bug report.
        if (cancelled) return;
        setProduct(null);
        setLoadFailed(!(error instanceof ApiError && error.status === 404));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadProduct();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);

  const selectedVariant =
    product?.variants.find((variant) => variant.id === selectedVariantId) ??
    product?.variants[0] ??
    null;

  // Resetting the quantity when the shopper picks a different size. Done during
  // render rather than in an effect: an effect runs after the DOM is painted, so
  // there was a frame showing the new variant beside the old variant's
  // quantity. This is React's documented way to adjust state on a prop change,
  // and it also drops the effect the dependency linter was complaining about.
  const [quantityVariantId, setQuantityVariantId] = useState(
    selectedVariant?.id,
  );
  if (selectedVariant && selectedVariant.id !== quantityVariantId) {
    setQuantityVariantId(selectedVariant.id);
    setQuantity(1);
  }

  if (load.pending) {
    return <PageLoading visible={load.visible} />;
  }

  if (loadFailed) {
    return (
      <div className={styles.notFound}>
        This page could not be loaded. It is a fault on our side, not a missing
        product — reloading often clears it.
      </div>
    );
  }

  if (!product) {
    return <div className={styles.notFound}>Product not found.</div>;
  }

  if (product.variants.length === 0) {
    return <div className={styles.notFound}>This product has no variants.</div>;
  }

  const activeVariant = selectedVariant ?? product.variants[0];
  const stock = variantStock(activeVariant.stock);

  // Only real images are rendered. The cart still needs a fallback, though - an
  // empty src makes the browser re-request the page and draw a broken image.
  const images = product.image_urls;
  const activeImage = images[selectedImageIndex] ?? images[0];

  // One variant does not need a table: a single row above a panel restating the
  // same size, price and stock is the page telling you the same thing twice.
  const hasChoice = product.variants.length > 1;

  const decreaseQuantity = () => setQuantity((prev) => Math.max(1, prev - 1));
  const increaseQuantity = () =>
    setQuantity((prev) => Math.min(activeVariant.stock, prev + 1));

  const constructAddToCartItem = (): AddToCartItem => ({
    productId: product.id,
    variantId: activeVariant.id,
    name: product.name,
    imageUrl: images[0] ?? DEFAULT_PRODUCT_IMAGE,
    catalogNumber: activeVariant.catalog_id,
    sizeLabel: `${activeVariant.size_value} ${activeVariant.size_unit}`,
    unitPrice: activeVariant.price,
    quantity,
  });

  return (
    <div className={styles.page}>
      <Link to="/products" className={styles.back}>
        All products
      </Link>

      {/*
        Identity first, full width, above everything. The catalog ID leads
        because it is the product's real name - it is what gets searched,
        written into a Methods section and quoted in an email to a supplier -
        and it was not rendered on this page at all before.
      */}
      <header className={styles.identity}>
        <div className={styles.identityText}>
          <span className={styles.catId}>{product.cat_id}</span>
          <h1 className={styles.name}>{product.name}</h1>
          {product.tags.length > 0 && (
            <ul className={styles.tags}>
              {product.tags.map((tag) => (
                <li key={tag.id}>
                  <Link
                    to={`/products?tag=${encodeURIComponent(tag.name)}`}
                    className={styles.tag}
                  >
                    {tag.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className={styles.priceSpan}>{formatPriceSpan(product.variants)}</p>
      </header>

      <div className={styles.body}>
        <div className={styles.main}>
          {hasChoice && (
            <div className={styles.tableScroll}>
              <table className={styles.variants}>
                <caption className={styles.caption}>Available sizes</caption>
                <thead>
                  <tr>
                    <th scope="col" className={styles.pick}>
                      <span className={styles.srOnly}>Select</span>
                    </th>
                    <th scope="col">Catalog ID</th>
                    <th scope="col">Size</th>
                    <th scope="col" className={styles.numeric}>
                      Price
                    </th>
                    <th scope="col" className={styles.numeric}>
                      Availability
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {product.variants.map((variant) => {
                    const isSelected = variant.id === activeVariant.id;
                    const rowStock = variantStock(variant.stock);

                    return (
                      <tr
                        key={variant.id}
                        className={isSelected ? styles.selected : undefined}
                        onClick={() => setSelectedVariantId(variant.id)}
                      >
                        {/*
                        A real radio, not a click handler on its own. It makes
                        the rows announce themselves as a choice, and brings
                        keyboard support with it - arrow keys move between sizes
                        - which clickable table rows do not have.
                      */}
                        <td className={styles.pick}>
                          <input
                            type="radio"
                            name="variant"
                            checked={isSelected}
                            onChange={() => setSelectedVariantId(variant.id)}
                            aria-label={`${variant.catalog_id}, ${variant.size_value} ${variant.size_unit}`}
                          />
                        </td>
                        <td className={styles.mono}>{variant.catalog_id}</td>
                        <td>
                          {variant.size_value} {variant.size_unit}
                        </td>
                        <td className={styles.numeric}>
                          ${variant.price.toFixed(2)}
                        </td>
                        <td
                          className={`${styles.numeric} ${styles[rowStock.tone]}`}
                        >
                          {rowStock.label}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <section className={styles.description}>
            <h2 className={styles.sectionTitle}>Description</h2>
            <p>{product.description}</p>
          </section>
        </div>

        <aside className={styles.aside}>
          {activeImage && (
            <figure className={styles.figure}>
              {/*
                A button, not an image with a click handler. For an antibody
                this picture is the validation data, and at 320px the bands
                cannot be read - so opening it full size is a real action and
                needs to be reachable from the keyboard.
              */}
              <button
                type="button"
                className={styles.imageButton}
                onClick={() => setViewerOpen(true)}
                aria-label={`View ${product.name} full size`}
              >
                <img
                  src={activeImage}
                  alt={product.name}
                  className={styles.image}
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_PRODUCT_IMAGE;
                  }}
                />
              </button>
              {images.length > 1 && (
                <p className={styles.imageCount}>
                  {selectedImageIndex + 1} of {images.length}
                </p>
              )}
              {images.length > 1 && (
                <div className={styles.thumbnails}>
                  {images.map((url, i) => (
                    <button
                      key={url}
                      type="button"
                      className={`${styles.thumbnail} ${
                        i === selectedImageIndex ? styles.thumbnailActive : ""
                      }`}
                      onClick={() => setSelectedImageIndex(i)}
                      aria-label={`Show image ${i + 1} of ${images.length}`}
                      aria-pressed={i === selectedImageIndex}
                    >
                      <img src={url} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </figure>
          )}

          <div className={styles.buy}>
            <dl className={styles.spec}>
              <dt>Catalog ID</dt>
              <dd className={styles.mono}>{activeVariant.catalog_id}</dd>
              <dt>Size</dt>
              <dd>
                {activeVariant.size_value} {activeVariant.size_unit}
              </dd>
              <dt>Availability</dt>
              <dd className={styles[stock.tone]}>{stock.label}</dd>
            </dl>

            <p className={styles.price}>${activeVariant.price.toFixed(2)}</p>

            <div className={styles.purchase}>
              <div className={styles.quantity}>
                <button
                  type="button"
                  onClick={decreaseQuantity}
                  disabled={quantity <= 1 || activeVariant.stock === 0}
                  aria-label="Decrease quantity"
                >
                  &minus;
                </button>
                <span aria-live="polite">{quantity}</span>
                <button
                  type="button"
                  onClick={increaseQuantity}
                  disabled={quantity >= activeVariant.stock}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>

              <AddToCartButton
                item={constructAddToCartItem()}
                available={activeVariant.stock}
              />
            </div>
          </div>
        </aside>
      </div>

      {viewerOpen && activeImage && (
        <ImageLightbox
          images={images}
          index={selectedImageIndex}
          onIndexChange={setSelectedImageIndex}
          onClose={() => setViewerOpen(false)}
          productName={product.name}
        />
      )}
    </div>
  );
}
