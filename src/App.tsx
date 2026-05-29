import { Routes, Route } from "react-router-dom";
import { Layout } from "./layout/Layout";
import { AdminLayout } from "./layout/AdminLayout";
import { HomePage } from "./pages/HomePage";
import { ProductsPage } from "./pages/ProductsPage";
import { CartPage } from "./pages/CartPage";
import { AboutPage } from "./pages/AboutPage";
import { OrdersPage } from "./pages/OrdersPage";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { AuthCallBackPage } from "./pages/AuthCallBackPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { OrderSuccessPage } from "./pages/OrderSuccessPage";
import { AdminRoute } from "./components/AdminRoute.tsx";
import { PrivateRoute } from "./components/PrivateRoute";
import { AdminProductsPage } from "./pages/AdminProductsPage";
import { AdminProductDetailPage } from "./pages/AdminProductDetailPage/AdminProductDetailPage.tsx";
import { AdminTagsPage } from "./pages/AdminTagsPage";
import { AdminOrdersPage } from "./pages/AdminOrdersPage";
import { AdminOrderDetailPage } from "./pages/AdminOrderDetailPage";

export default function App() {
  return (
    <Routes>
      {/* Public + authenticated customer routes */}
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/products/:productId" element={<ProductDetailPage />} />
        <Route path="/auth/callback" element={<AuthCallBackPage />} />
        <Route path="/checkout/success" element={<OrderSuccessPage />} />
        <Route path="/checkout" element={<PrivateRoute><CheckoutPage /></PrivateRoute>} />
        <Route path="/orders" element={<PrivateRoute><OrdersPage /></PrivateRoute>} />
        <Route path="/orders/:orderId" element={<PrivateRoute><OrderDetailPage /></PrivateRoute>} />
      </Route>

      {/* Admin routes — new AdminLayout shell */}
      <Route element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route path="/admin/products" element={<AdminProductsPage />} />
        <Route path="/admin/products/new" element={<AdminProductDetailPage />} />
        <Route path="/admin/products/:productId" element={<AdminProductDetailPage />} />
        <Route path="/admin/tags" element={<AdminTagsPage />} />
        <Route path="/admin/orders" element={<AdminOrdersPage />} />
        <Route path="/admin/orders/:orderId" element={<AdminOrderDetailPage />} />
      </Route>
    </Routes>
  );
}
