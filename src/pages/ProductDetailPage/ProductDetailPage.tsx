import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import styles from "./ProductDetailPage.module.css";
import shared from "../../styles/shared.module.css";
import { getProductById } from "../../api/product";
import type { Product } from "../../types/product_type";
import type { AddToCartItem } from "../../types/cart_types";
import { AddToCartButton } from "../../components/AddToCartButton";
import { LoadingOverlay } from "../../components/LoadingSpinner";
import { DEFAULT_PRODUCT_IMAGE } from "../../constants/product";


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

  const selectedVariant =
    product?.variants.find((variant) => variant.id === selectedVariantId) ??
    product?.variants[0] ??
    null;

  useEffect(() => {
    if (!selectedVariant) return;
    setQuantity(1);
  }, [selectedVariant?.id]);

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
      imageUrl: product.image_url || DEFAULT_PRODUCT_IMAGE,
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
            src={DEFAULT_PRODUCT_IMAGE}
            alt={product.name}
            className={styles.productImage}
          />
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
                    <td>${Number(variant.price).toFixed(2)}</td>
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
            <p className={styles.price}>${Number(activeVariant.price).toFixed(2)}</p>

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