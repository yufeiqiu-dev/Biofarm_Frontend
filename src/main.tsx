import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "./styles/global.css";
import { AuthProvider } from "./auth/AuthContext";
import { CartSideBarProvider } from "./context/CartSideBarContext";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CartSideBarProvider>
          <App />
        </CartSideBarProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);