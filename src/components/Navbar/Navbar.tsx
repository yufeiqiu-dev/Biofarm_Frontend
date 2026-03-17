import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { SearchBar } from "../SearchBar";
import styles from "./Navbar.module.css";

export function Navbar() {
  const navigate = useNavigate();
  const { user, signIn, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleAccountClick = () => {
    setMenuOpen((open) => !open);
  };

  const handleOrdersClick = () => {
    setMenuOpen(false);
    navigate("/orders");
  };

  const handleSignOutClick = () => {
    setMenuOpen(false);
    signOut();
  };

  return (
    <header className={styles.navbar}>
      <div className={styles.topRow}>
        <Link to="/" className={styles.logo}>
          Biofarm
        </Link>

        <div className={styles.searchArea}>
          <SearchBar />
        </div>

        <div className={styles.actions}>

          {!user ? (
            <button
              type="button"
              className={styles.signInButton}
              onClick={signIn}
            >
              Sign in
            </button>
          ) : (
            <div className={styles.accountWrapper}>
              <button
                type="button"
                className={styles.accountButton}
                onClick={handleAccountClick}
              >
                My Account ▾
              </button>

              {menuOpen && (
                <div className={styles.menu}>
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={handleOrdersClick}
                  >
                    <span className={styles.menuLink}>Orders</span>
                  </button>
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={handleSignOutClick}
                  >
                    <span className={styles.menuLink}>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          )}
          <NavLink
            to="/cart"
            className={({ isActive }) =>
              isActive ? `${styles.actionLink} ${styles.linkActive}` : styles.actionLink
            }
          >
            Cart
          </NavLink>
        </div>
      </div>

      <nav className={styles.bottomRow}>
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            isActive ? `${styles.link} ${styles.linkActive}` : styles.link
          }
        >
          Home
        </NavLink>

        <NavLink
          to="/products"
          className={({ isActive }) =>
            isActive ? `${styles.link} ${styles.linkActive}` : styles.link
          }
        >
          Products
        </NavLink>

        <NavLink
          to="/about"
          className={({ isActive }) =>
            isActive ? `${styles.link} ${styles.linkActive}` : styles.link
          }
        >
          About Us
        </NavLink>

        <NavLink
          to="/services"
          className={({ isActive }) =>
            isActive ? `${styles.link} ${styles.linkActive}` : styles.link
          }
        >
          Services
        </NavLink>

        <NavLink
          to="/resources"
          className={({ isActive }) =>
            isActive ? `${styles.link} ${styles.linkActive}` : styles.link
          }
        >
          Resources
        </NavLink>
      </nav>
    </header>
  );
}