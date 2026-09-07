import { Routes, Route } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
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
import { NotFoundPage } from "./pages/NotFoundPage";
import { AdminRoute } from "./components/AdminRoute.tsx";
import { PrivateRoute } from "./components/PrivateRoute";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { AdminProductsPage } from "./pages/AdminProductsPage";
import { AdminProductDetailPage } from "./pages/AdminProductDetailPage/AdminProductDetailPage.tsx";
import { AdminTagsPage } from "./pages/AdminTagsPage";
import { AdminOrdersPage } from "./pages/AdminOrdersPage";
import { AdminOrderDetailPage } from "./pages/AdminOrderDetailPage";

export default function App() {
  return (
    <>
      {/* Sits above the routes so it runs on every navigation, not per page. */}
      <ScrollToTop />

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
          <Route
            path="/checkout"
            element={
              <PrivateRoute>
                <CheckoutPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <PrivateRoute>
                <OrdersPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/orders/:orderId"
            element={
              <PrivateRoute>
                <OrderDetailPage />
              </PrivateRoute>
            }
          />
        </Route>

        {/* Admin routes — new AdminLayout shell */}
        <Route
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          {/*
            /admin used to fall through to the 404 page.

            An explicit path, not an index route: this parent is a pathless
            layout, so `index` matches the *parent's* path - which is "/". That
            put the dashboard on the home page behind AdminRoute, which
            redirects to "/", and the storefront stopped loading entirely.
          */}
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/products" element={<AdminProductsPage />} />
          <Route
            path="/admin/products/new"
            element={<AdminProductDetailPage />}
          />
          <Route
            path="/admin/products/:productId"
            element={<AdminProductDetailPage />}
          />
          <Route path="/admin/tags" element={<AdminTagsPage />} />
          <Route path="/admin/orders" element={<AdminOrdersPage />} />
          <Route
            path="/admin/orders/:orderId"
            element={<AdminOrderDetailPage />}
          />
        </Route>

        {/* Catch-all 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
