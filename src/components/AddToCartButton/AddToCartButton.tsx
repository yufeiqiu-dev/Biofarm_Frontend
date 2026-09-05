import { useCartSideBar } from "../../context/useCartSideBar";
import { useAuth } from "../../auth/useAuth";
import { useReminder } from "../../context/useReminder";
import type { AddToCartItem } from "../../types/cart_types";
import shared from "../../styles/shared.module.css";

interface Props {
  item: AddToCartItem;
  /**
   * Units available. Omitted means "not known here" and the button behaves as
   * before; zero disables it.
   *
   * This exists because the listing pages did not know about stock at all, so
   * the shortest path to a broken order was the most prominent button on the
   * site: add an out-of-stock product from the home page, pay, and have it fail
   * at admin-confirm after the card was already authorized. Only the product
   * detail page checked.
   */
  available?: number;
}

export function AddToCartButton({ item, available }: Props) {
  const { openCartSideBar, addToCart, cartItems } = useCartSideBar();
  const { user } = useAuth();
  const { showReminder } = useReminder();

  const soldOut = available === 0;
  const inCart = cartItems.some((cartItem) => cartItem.variantId === item.variantId);

  const handleAddToCart = () => {
    if (!user) {
      showReminder({ message: "Please sign in before adding items to your cart." });
      return;
    }

    if (soldOut) return;

    if (inCart) {
      openCartSideBar();
      return;
    }

    addToCart(item);
  };

  return (
    <button
      className={shared.primaryButton}
      onClick={handleAddToCart}
      disabled={soldOut}
      // Says why it cannot be used, rather than leaving a dead grey button.
      aria-label={soldOut ? `${item.name} is out of stock` : undefined}
    >
      {soldOut ? "Out of stock" : inCart ? "In cart" : "Add to cart"}
    </button>
  );
}
