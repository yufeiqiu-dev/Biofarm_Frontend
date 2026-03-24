import { useCartSideBar } from "../../context/CartSideBarContext";
import { useAuth } from "../../auth/AuthContext";
import { useReminder } from "../../context/ReminderContext";
import type { AddToCartItem } from "../../types/cart_types";
import shared from "../../styles/shared.module.css";

interface Props {
    item: AddToCartItem;
  }
  
  export function AddToCartButton({ item }: Props) {
    const { openCartSideBar, addToCart, cartItems } = useCartSideBar();
    const { user } = useAuth();
    const { showReminder } = useReminder();
  
    const isInCart = cartItems.some(
      (cartItem) => cartItem.variantId === item.variantId
    );
  
    const handleAddToCart = () => {
      if (!user) {
        showReminder({
          message: "Please sign in before adding items to your cart.",
        });
        return;
      }

      if (isInCart) {
        openCartSideBar();
        return;
      }
      addToCart(item);
    };
  
    return (
      <button
        className={shared.primaryButton}
        onClick={handleAddToCart}
      >
        {isInCart ? "In Cart" : "Add to cart"}
      </button>
    );
}