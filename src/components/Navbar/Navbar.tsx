import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { SearchBar } from "../SearchBar";
import { useCartSideBar } from "../../context/useCartSideBar";
import styles from "./Navbar.module.css";

function getInitials(name: string): string {
  return name
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

export function Navbar() {
  const navigate = useNavigate();
  const { user, signIn, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showBottomRow, setShowBottomRow] = useState(true);
  const { toggleCartSideBar } = useCartSideBar();
  const accountWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setShowBottomRow(window.scrollY <= 10);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (accountWrapperRef.current && !accountWrapperRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const handleAccountClick = () => {
    setMenuOpen((open) => !open);
  };

  const handleOrdersClick = () => {
    setMenuOpen(false);
    navigate("/orders");
  };

  const handleAdminClick = () => {
    setMenuOpen(false);
    navigate("/admin/products");
  };

  const handleSignOutClick = () => {
    setMenuOpen(false);
    void signOut();
  };

  const handleCartClick = () => {
    // There is no /signin route and there never was - sign-in is Cognito's
    // hosted UI, which signIn() redirects to. Navigating to a path the router
    // does not know sent the shopper to the 404 page instead, from a click on
    // the cart. signIn() also records the current path, so they come back here.
    if (!user) {
      void signIn();
      return;
    }
    toggleCartSideBar();
  };

  return (
    <header className={styles.navbar}>
      <div className={styles.topRow}>
        <Link to="/" className={styles.logo}>
          Oasis Biofarm
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
            <div className={styles.accountWrapper} ref={accountWrapperRef}>
              <button
                type="button"
                className={styles.accountButton}
                onClick={handleAccountClick}
              >
                <span className={styles.accountAvatar}>
                  {getInitials(user.name)}
                </span>
                <span className={styles.accountName}>{user.name}</span>
                <span className={styles.accountChevron}>▾</span>
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

                  {user.roles?.includes("Admin") && (
                    <button
                      type="button"
                      className={styles.menuItem}
                      onClick={handleAdminClick}
                    >
                      <span className={styles.menuLink}>Admin</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className={`${styles.menuItem} ${styles.menuItemDanger}`}
                    onClick={handleSignOutClick}
                  >
                    <span className={styles.menuLink}>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            className={styles.cartButton}
            onClick={handleCartClick}
          >
            Cart
          </button>
        </div>
      </div>

      <nav
        className={`${styles.bottomRow} ${
          showBottomRow ? styles.bottomRowVisible : styles.bottomRowHidden
        }`}
      >
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
      </nav>
    </header>
  );
}