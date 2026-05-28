import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getProducts } from "../../api/product";
import type { Product } from "../../types/product_type";
import { ProductCard } from "../../components/ProductCard";
import { LoadingOverlay } from "../../components/LoadingSpinner";
import shared from "../../styles/shared.module.css";
import styles from "./HomePage.module.css";


const categories = [
  {
    name: "Tool Antibodies",
    description: "Antibodies for tags and fluorescent proteins.",
    path: "/products?tag=tool-antibodies",
    gradient: "linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)",
  },
  {
    name: "Secondary Antibodies",
    description: "Secondary antibodies for multi-channel IF staining.",
    path: "/products?tag=secondary-antibodies",
    gradient: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
  },
  {
    name: "Brain Organoid",
    description: "Antibodies for organoid research.",
    path: "/products?tag=brain-organoid",
    gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
  },
  {
    name: "Glial Cells",
    description: "Antibodies for glia and microglia.",
    path: "/products?tag=glial-cells",
    gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
  },
  {
    name: "Neurons",
    description: "Antibodies for neuronal and neural markers.",
    path: "/products?tag=neurons",
    gradient: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)",
  },
  {
    name: "Reagents & Kits",
    description: "Myelin staining kits and other research reagents.",
    path: "/products?tag=reagents-kits",
    gradient: "linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)",
  },
];

export function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [featuredError, setFeaturedError] = useState(false);

  useEffect(() => {
    const loadFeaturedProducts = async () => {
      try {
        setLoading(true);

        const data = await getProducts();

        const cleanedProducts = data.filter((product) => product.variants.length > 0);
        setFeaturedProducts(cleanedProducts.slice(0, 4));
      } catch (error) {
        console.error("Failed to load featured products:", error);
        setFeaturedError(true);
      } finally {
        setLoading(false);
      }
    };

    void loadFeaturedProducts();
  }, []);

  return (
    <div className={shared.page}>
      {loading && <LoadingOverlay visible={true} />}

      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>Biofarm for Research</p>
          <h1 className={styles.heroTitle}>
            Research-Grade Antibodies, Reagents, and Lab Essentials
          </h1>
          <p className={styles.heroSubtitle}>
            Source trusted biomedical products for molecular biology,
            immunology, cell biology, and translational research.
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
              <div
                className={styles.categoryImageWrapper}
                style={{ background: category.gradient }}
              >
                <div className={styles.categoryBanner}>{category.name}</div>
              </div>

              <div className={styles.categoryContent}>
                <p>{category.description}</p>
              </div>
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
          <p style={{ color: "#667085" }}>Unable to load products right now.</p>
        ) : (
          <div className={shared.productGrid}>
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}