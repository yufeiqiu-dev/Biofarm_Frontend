import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "./styles/global.css";
import { AuthProvider } from "./auth/AuthContext";
import { CartSideBarProvider } from "./context/CartSideBarContext";
import { ReminderProvider } from "./context/ReminderContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./amplify";

/*
 * Two boundaries, at different depths, and both are needed.
 *
 * The one inside App wraps the routes. Layout is rendered *by* those routes, so
 * a page throw still unmounts the shell - this does not contain a failure to the
 * page, and saying so would be a promise the placement does not keep. What it
 * does is give a throw below the router a fallback with a way out, instead of a
 * white screen.
 *
 * It is deliberately not keyed on the path: re-keying reset the error but
 * remounted Layout, Navbar and the cart sidebar on every navigation. The
 * fallback offers a full navigation home instead, which both clears the error
 * and escapes a route that throws every time.
 *
 * Containing a throw to the page itself would mean a third boundary around
 * Layout's <Outlet />. Worth doing; not done here.
 *
 * This one sits above every provider, because a provider is not covered by a
 * boundary it renders. AuthProvider choking on a malformed cached session, or
 * CartSideBarProvider on unparseable stored cart data, would throw *outside*
 * the inner boundary and produce exactly the blank page the component exists to
 * prevent. Outermost is the only position that catches those.
 */
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {/*
      The outer boundary gets a reset, because navigating cannot clear what it
      catches. A throw from a provider is path-independent: the same provider
      re-mounts on every route with the same stored input and throws again, so
      "go to the home page" leads back to the same wall. The causes worth
      catching here are stored state we wrote ourselves - a malformed cached
      session, unparseable cart data - and clearing site storage is the one
      action that actually resolves them.

      It signs the reader out and empties their cart, so it is labelled with
      what it costs rather than as a neutral third option.
    */}
    <ErrorBoundary
      reset={{
        label: "Sign out and clear saved data",
        onReset: () => {
          // Two try blocks, not one. Sharing a catch meant a browser that
          // blocks localStorage while leaving sessionStorage writable skipped
          // the second clear entirely - so the poison value survived, the
          // reader was returned to "/", and the same provider threw again. A
          // button whose whole purpose is escaping that must not have a path
          // where it silently does nothing.
          try {
            window.localStorage.clear();
          } catch {
            // Blocked storage is already in the state we want.
          }
          try {
            window.sessionStorage.clear();
          } catch {
            // Same.
          }
          window.location.href = "/";
        },
      }}
    >
      <BrowserRouter>
        <ReminderProvider>
          <AuthProvider>
            <CartSideBarProvider>
              <App />
            </CartSideBarProvider>
          </AuthProvider>
        </ReminderProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
