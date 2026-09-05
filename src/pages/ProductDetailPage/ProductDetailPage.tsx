import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DEFAULT_PRODUCT_IMAGE } from "../../constants/product";
import styles from "./ProductDetailPage.module.css";
import { getProductById } from "../../api/product";
import type { Product } from "../../types/product_type";
import type { AddToCartItem } from "../../types/cart_types";
import { AddToCartButton } from "../../components/AddToCartButton";
import { PageLoading, useLoadingState } from "../../components/LoadingSpinner";
import {
  formatPriceSpan,
  variantStock,
} from "../../components/ProductCard/productSummary";

export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
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

    const loadProduct = async () => {
      try {
        setLoading(true);
        const p = await getProductById(productId);
        setProduct(p);
      } catch (error) {
        console.error("Failed to load product", error);
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };

    void loadProduct();
  }, [productId]);

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

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
              <img
                src={activeImage}
                alt={product.name}
                className={styles.image}
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_PRODUCT_IMAGE;
                }}
              />
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
    </div>
  );
}
