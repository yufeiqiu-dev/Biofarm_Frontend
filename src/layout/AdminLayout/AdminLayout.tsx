import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import styles from "./AdminLayout.module.css";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink;

export function AdminLayout() {
  const { user, signOut } = useAuth();

  const initials = user?.name
    ? user.name
        .split(/[\s@.]+/)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase() ?? "")
        .join("")
    : "A";

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>Biofarm Admin</div>

        <nav className={styles.nav} aria-label="Admin navigation">
          <NavLink to="/admin/orders" className={navLinkClass}>
            Orders
          </NavLink>
          <NavLink to="/admin/products" className={navLinkClass}>
            Products
          </NavLink>
          <NavLink to="/admin/tags" className={navLinkClass}>
            Tags
          </NavLink>
        </nav>

        <div className={styles.bottom}>
          <div className={styles.divider} />

          {user && (
            <div className={styles.userCard}>
              <div className={styles.avatar}>{initials}</div>
              <div className={styles.userInfo}>
                <span className={styles.userName}>{user.name}</span>
              </div>
            </div>
          )}

          <Link to="/" className={styles.bottomLink}>
            <span className={styles.bottomLinkIcon}>←</span>
            View Store
          </Link>

          <button
            type="button"
            className={styles.signOutButton}
            onClick={() => void signOut()}
          >
            <span className={styles.bottomLinkIcon}>↪</span>
            Sign Out
          </button>
        </div>
      </aside>

      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}
