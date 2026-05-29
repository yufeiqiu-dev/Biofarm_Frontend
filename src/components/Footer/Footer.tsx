import { Link } from "react-router-dom";
import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <span className={styles.logo}>Oasis Biofarm</span>
          <p className={styles.tagline}>
            Precision antibodies and diagnostic kits for neurodegenerative disease research.
          </p>
        </div>

        <nav className={styles.links}>
          <div className={styles.col}>
            <div className={styles.colTitle}>Products</div>
            <Link to="/products" className={styles.link}>All Products</Link>
            <Link to="/products?tag=tool-antibodies" className={styles.link}>Tool Antibodies</Link>
            <Link to="/products?tag=reagents-kits" className={styles.link}>Reagents &amp; Kits</Link>
          </div>
          <div className={styles.col}>
            <div className={styles.colTitle}>Company</div>
            <Link to="/about" className={styles.link}>About Us</Link>
            <Link to="/orders" className={styles.link}>My Orders</Link>
          </div>
          <div className={styles.col}>
            <div className={styles.colTitle}>Contact</div>
            <a href="mailto:hh@oasisbiofarm.net" className={styles.link}>Sales</a>
            <a href="mailto:support@oasisbiofarm.net" className={styles.link}>Technical Support</a>
          </div>
        </nav>
      </div>

      <div className={styles.bottom}>
        <span>© {new Date().getFullYear()} Oasis Biofarm. All rights reserved.</span>
      </div>
    </footer>
  );
}
