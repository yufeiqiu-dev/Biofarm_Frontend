import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getProducts } from "../../api/product";
import type { Product } from "../../types/product_type";
import { ProductCard, ProductList } from "../../components/ProductCard";
import { PageLoading, useLoadingState } from "../../components/LoadingSpinner";
import shared from "../../styles/shared.module.css";
import styles from "./HomePage.module.css";


const categories = [
  {
    name: "Tool Antibodies",
    description: "Antibodies for tags and fluorescent proteins.",
    path: "/products?tag=tool-antibodies",
  },
  {
    name: "Secondary Antibodies",
    description: "Secondary antibodies for multi-channel IF staining.",
    path: "/products?tag=secondary-antibodies",
  },
  {
    name: "Brain Organoid",
    description: "Antibodies for organoid research.",
    path: "/products?tag=brain-organoid",
  },
  {
    name: "Glial Cells",
    description: "Antibodies for glia and microglia.",
    path: "/products?tag=glial-cells",
  },
  {
    name: "Neurons",
    description: "Antibodies for neuronal and neural markers.",
    path: "/products?tag=neurons",
  },
  {
    name: "Reagents & Kits",
    description: "Myelin staining kits and other research reagents.",
    path: "/products?tag=reagents-kits",
  },
];

export function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [featuredError, setFeaturedError] = useState(false);
  const load = useLoadingState(loading);

  useEffect(() => {
    const loadFeaturedProducts = async () => {
      try {
        setLoading(true);

        const data = await getProducts();

        const cleanedProducts = data.filter((product) => product.variants.length > 0);
        setFeaturedProducts(cleanedProducts.slice(0, 4));
      } catch {
        setFeaturedError(true);
      } finally {
        setLoading(false);
      }
    };

    void loadFeaturedProducts();
  }, []);

  return (
    <div className={shared.page}>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>Research Antibodies &amp; Diagnostics</p>
          <h1 className={styles.heroTitle}>
            Antibodies and diagnostic kits for neurological research
          </h1>
          <p className={styles.heroSubtitle}>
            Trusted by researchers worldwide. High-specificity antibodies, assay kits, and reagents for Alzheimer&apos;s, Parkinson&apos;s, and neuroscience applications.
          </p>

          <div className={styles.heroActions}>
            <Link to="/products" className={shared.primaryButton}>
              Browse Products
            </Link>
            <Link to="/about" className={styles.secondaryButton}>
              Learn More
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Shop by Category</h2>
        </div>

        <div className={styles.categoryGrid}>
          {categories.map((category) => (
            <Link
              key={category.name}
              to={category.path}
              className={styles.categoryCard}
            >
              <span className={styles.categoryName}>{category.name}</span>
              <span className={styles.categoryDescription}>
                {category.description}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Featured Products</h2>
          <Link to="/products" className={shared.link}>
            View all &rarr;
          </Link>
        </div>

        {featuredError ? (
          <p className={styles.loadError}>Unable to load products right now.</p>
        ) : load.pending ? (
          <PageLoading label="Loading products..." compact visible={load.visible} />
        ) : (
          <ProductList products={featuredProducts}>
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </ProductList>
        )}
      </section>
    </div>
  );
}