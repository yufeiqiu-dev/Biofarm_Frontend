import { Link } from "react-router-dom";
import { mockProducts } from "../../mock/mockProducts";
import { ProductCard } from "../../components/ProductCard";
import shared from "../../styles/shared.module.css";
import styles from "./HomePage.module.css";


const categories = [
  {
    name: "Tool Antibodies",
    description: "Antibodies for tags and fluorescent proteins.",
    path: "/products?category=tool-antibodies",
  },
  {
    name: "Secondary Antibodies",
    description: "Secondary antibodies for multi-channel IF staining.",
    path: "/products?category=secondary-antibodies",
  },
  {
    name: "Brain Organoid",
    description: "Antibodies for organoid research.",
    path: "/products?category=brain-organoid",
  },
  {
    name: "Glial Cells",
    description: "Antibodies for glia and microglia.",
    path: "/products?category=glial-cells",
  },
  {
    name: "Neurons",
    description: "Antibodies for neuronal and neural markers.",
    path: "/products?category=neurons",
  },
  {
    name: "Reagents & Kits",
    description: "Myelin staining kits and other research reagents.",
    path: "/products?category=reagents-kits",
  },
];

const featuredProducts = mockProducts.slice(0, 4);

export function HomePage() {
  return (
    <div className={shared.page}>
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
            <div className={styles.categoryImageWrapper}>
              <img
                src={"/images/categories/example.jpeg"}
                alt={category.name}
                className={styles.categoryImage}
              />
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

        <div className={shared.productGrid}>
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}