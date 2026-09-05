import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { DEFAULT_PRODUCT_IMAGE } from "../../constants/product";
import styles from "./ProductDetailPage.module.css";
import shared from "../../styles/shared.module.css";
import { getProductById } from "../../api/product";
import type { Product } from "../../types/product_type";
import type { AddToCartItem } from "../../types/cart_types";
import { AddToCartButton } from "../../components/AddToCartButton";
import { LoadingOverlay } from "../../components/LoadingSpinner";


export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

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
  const [quantityVariantId, setQuantityVariantId] = useState(selectedVariant?.id);
  if (selectedVariant && selectedVariant.id !== quantityVariantId) {
    setQuantityVariantId(selectedVariant.id);
    setQuantity(1);
  }

  if (loading) {
    return <LoadingOverlay visible={true} />;
  }

  if (!product) {
    return <div className={styles.notFound}>Product not found.</div>;
  }

  if (product.variants.length === 0) {
    return <div className={styles.notFound}>This product has no variants.</div>;
  }

  const activeVariant = selectedVariant ?? product.variants[0];
  const images = product.image_urls.length > 0 ? product.image_urls : [DEFAULT_PRODUCT_IMAGE];
  const activeImage = images[selectedImageIndex] ?? DEFAULT_PRODUCT_IMAGE;

  const decreaseQuantity = () => {
    setQuantity((prev) => Math.max(1, prev - 1));
  };

  const increaseQuantity = () => {
    setQuantity((prev) => Math.min(activeVariant.stock, prev + 1));
  };

  const constructAddToCartItem = (): AddToCartItem => {
    return {
      productId: product.id,
      variantId: activeVariant.id,
      name: product.name,
      imageUrl: images[0],
      catalogNumber: activeVariant.catalog_id,
      sizeLabel: `${activeVariant.size_value} ${activeVariant.size_unit}`,
      unitPrice: activeVariant.price,
      quantity,
    };
  };

  return (
    <div className={styles.page}>
      <div className={styles.topSection}>
        <div className={styles.imageSection}>
          <img
            src={activeImage}
            alt={product.name}
            className={styles.productImage}
            onError={(e) => { e.currentTarget.src = DEFAULT_PRODUCT_IMAGE; }}
          />
          {images.length > 1 && (
            <div className={styles.thumbnailStrip}>
              {images.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`${product.name} ${i + 1}`}
                  className={`${styles.thumbnail} ${i === selectedImageIndex ? styles.thumbnailActive : ""}`}
                  onClick={() => setSelectedImageIndex(i)}
                  onError={(e) => { e.currentTarget.src = DEFAULT_PRODUCT_IMAGE; }}
                />
              ))}
            </div>
          )}
        </div>

        <div className={styles.variantSection}>
          <h1 className={styles.productName}>{product.name}</h1>

          <table className={styles.variantTable}>
            <thead>
              <tr>
                <th>Catalog ID</th>
                <th>Size</th>
                <th>Price</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {product.variants.map((variant) => {
                const isSelected = variant.id === activeVariant.id;

                return (
                  <tr
                    key={variant.id}
                    className={isSelected ? styles.selectedRow : ""}
                    onClick={() => setSelectedVariantId(variant.id)}
                  >
                    <td>{variant.catalog_id}</td>
                    <td>
                      {variant.size_value} {variant.size_unit}
                    </td>
                    <td>${variant.price.toFixed(2)}</td>
                    <td>{variant.stock > 0 ? "Available" : "Out of stock"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={styles.priceSection}>
          <div className={styles.priceCard}>
            <p className={styles.label}>Selected Product Size</p>
            <p className={styles.info}>
              {activeVariant.size_value} {activeVariant.size_unit}
            </p>

            <p className={styles.label}>Price</p>
            <p className={styles.price}>${activeVariant.price.toFixed(2)}</p>

            {activeVariant.stock > 0 ? (
              <div className={styles.purchaseRow}>
                <div className={styles.quantitySelector}>
                  <button
                    type="button"
                    className={styles.quantityButton}
                    onClick={decreaseQuantity}
                    disabled={quantity <= 1}
                  >
                    -
                  </button>

                  <span className={styles.quantityValue}>{quantity}</span>

                  <button
                    type="button"
                    className={styles.quantityButton}
                    onClick={increaseQuantity}
                    disabled={quantity >= activeVariant.stock}
                  >
                    +
                  </button>
                </div>

                <div className={styles.addToCartWrapper}>
                  <AddToCartButton item={constructAddToCartItem()} />
                </div>
              </div>
            ) : (
              <button className={shared.primaryButton} disabled>
                Out of stock
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={styles.descriptionSection}>
        <h2>Description</h2>
        <p>{product.description}</p>
      </div>
    </div>
  );
}