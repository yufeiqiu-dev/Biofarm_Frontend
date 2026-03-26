import { Routes, Route } from "react-router-dom";
import { Layout } from "./layout/Layout";
import { HomePage } from "./pages/HomePage";
import { ProductsPage } from "./pages/ProductsPage";
import { CartPage } from "./pages/CartPage";
import { AboutPage } from "./pages/AboutPage";
import { OrdersPage } from "./pages/OrdersPage";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { AuthCallBackPage } from "./pages/AuthCallBackPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/products/:productId" element={<ProductDetailPage />} />
        <Route path="/auth/callback" element={<AuthCallBackPage />} />
      </Route>
    </Routes>
  );
}