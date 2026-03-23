import { Outlet } from "react-router-dom";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { CartSideBar } from "../../components/CartSideBar";
import { useLayoutEffect, useRef, useState } from "react";
import styles from "./Layout.module.css";

export function Layout() {
  const navbarWrapperRef = useRef<HTMLDivElement | null>(null);
  const [navbarHeight, setNavbarHeight] = useState(0);

  useLayoutEffect(() => {
    const node = navbarWrapperRef.current;
    if (!node) return;

    const updateHeight = () => {
      const height = node.getBoundingClientRect().height;
      setNavbarHeight(height);
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
    });

    resizeObserver.observe(node);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);
  return (
    <div className={styles.root}>
      <div ref={navbarWrapperRef}>
        <Navbar />
      </div>

      <main className={styles.main}>
        <Outlet />
      </main>

      <CartSideBar topOffset={navbarHeight} />

      <Footer />
    </div>
  );
}

