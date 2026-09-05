import { Outlet } from "react-router-dom";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { CartSideBar } from "../../components/CartSideBar";
import { ReminderToast } from "../../components/ReminderToast";
import styles from "./Layout.module.css";

export function Layout() {
  return (
    <div className={styles.root}>
      <Navbar />

      <main className={styles.main}>
        <Outlet />
      </main>

      <CartSideBar />
      <ReminderToast />
      <Footer />
    </div>
  );
}
