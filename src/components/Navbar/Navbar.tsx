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
    // The dashboard, not the product list. /admin renders it and always has;
    // this button was the one thing routing past it, so the queue counts, the
    // card-hold warnings and the day's takings were only ever seen by someone
    // who edited the URL.
    navigate("/admin");
  };

  const handleSignOutClick = () => {
    setMenuOpen(false);
    void signOut();
  };

  const handleCartClick = () => {
    // The basket is local-first and open to guests - a signed-out visitor can
    // build one and see it here, same as anyone else. Signing in is only
    // prompted at checkout, once there is something worth carrying across a
    // device. (This used to navigate to "/signin", a route that never existed,
    // then to gate on `!user` with a reminder - both from when the basket
    // lived on the server and a guest had nothing to show.)
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