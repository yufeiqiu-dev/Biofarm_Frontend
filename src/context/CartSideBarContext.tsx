import {
    createContext,
    useContext,
    useState,
    type ReactNode,
  } from "react";
  
  type CartSideBarContextValue = {
    isOpen: boolean;
    toggleCartSideBar: () => void;
    openCartSideBar: () => void;
    closeCartSideBar: () => void;
  };
  
  const CartSideBarContext = createContext<CartSideBarContextValue | undefined>(
    undefined
  );
  
  export function CartSideBarProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
  
    const toggleCartSideBar = () => setIsOpen((prev) => !prev);
    const openCartSideBar = () => setIsOpen(true);
    const closeCartSideBar = () => setIsOpen(false);
  
    return (
      <CartSideBarContext.Provider
        value={{ isOpen, toggleCartSideBar, openCartSideBar, closeCartSideBar }}
      >
        {children}
      </CartSideBarContext.Provider>
    );
  }
  
  export function useCartSideBar() {
    const context = useContext(CartSideBarContext);
  
    if (!context) {
      throw new Error("useCartSideBar must be used within a CartSideBarProvider");
    }
  
    return context;
  }