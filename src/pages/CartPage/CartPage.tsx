import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useCartSideBar } from "../../context/CartSideBarContext";
import shared from "../../styles/shared.module.css";

export function CartPage() {
  const { cartItems } = useCartSideBar();
  const { isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();

  const total = cartItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      await signIn();
      return;
    }
    navigate("/checkout");
  };

  return (
    <div className={shared.page}>
      <h1>Your Cart</h1>
      {cartItems.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <>
          <p>{cartItems.length} item(s) — Total: ${total.toFixed(2)}</p>
          <button onClick={handleCheckout}>
            {isAuthenticated ? "Proceed to Checkout" : "Sign in to Checkout"}
          </button>
        </>
      )}
    </div>
  );
}
