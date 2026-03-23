import styles from "./CartSideBar.module.css";

type CartSideBarProps = {
    topOffset: number;
  };

export function CartSideBar({ topOffset }: CartSideBarProps) {
  return (
    <div className={styles.cartSideBar}       
    style={{
        top: `${topOffset}px`,
        height: `calc(100vh - ${topOffset}px)`,
      }}>
      <h2>Cart</h2>
    </div>
  );
}