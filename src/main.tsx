import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "./styles/global.css";
import { AuthProvider } from "./auth/AuthContext";
import { CartSideBarProvider } from "./context/CartSideBarContext";
import { ReminderProvider } from "./context/ReminderContext";
import "./amplify";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
    <ReminderProvider>
      <AuthProvider>
        <CartSideBarProvider>
            <App />
          </CartSideBarProvider>
        </AuthProvider>
      </ReminderProvider>
    </BrowserRouter>
  </React.StrictMode>
);