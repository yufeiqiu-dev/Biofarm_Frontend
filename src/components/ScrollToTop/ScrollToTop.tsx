import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Puts a new page at the top, the way a new page arrives in a browser.
 *
 * Nothing did this before, so the scroll offset simply carried over between
 * routes. Reach the bottom of a product page, click Home, and you stayed at
 * that offset - which meant the dark footer was what was on screen while the
 * new page rendered, and then content appeared around it. Read as a brief dark
 * flash on the way to the home and products pages; it was the previous page's
 * scroll position.
 *
 * useLayoutEffect rather than useEffect: this has to happen before the browser
 * paints, or there is a frame of the new page drawn at the old offset - which is
 * the flash, just shorter.
 *
 * Only on pathname changes. The listing filters by writing ?tag= into the query
 * string, and yanking someone back to the top when they tick a filter is its own
 * small hostility.
 *
 * Only on PUSH and REPLACE. A POP is the back button, where the browser restores
 * the position you left and overriding that loses your place in a long list.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const previousPathname = useRef(pathname);

  useLayoutEffect(() => {
    const changedPage = previousPathname.current !== pathname;
    previousPathname.current = pathname;

    if (navigationType === "POP") return;

    // Comparing the path itself rather than trusting the effect to fire only on
    // a real page change. navigationType is a dependency too, and it flips from
    // POP to PUSH on the first navigation of a session - so ticking a filter,
    // which changes nothing but the query string, still ran this once and threw
    // the reader back to the top.
    if (!changedPage) return;

    window.scrollTo(0, 0);
  }, [pathname, navigationType]);

  return null;
}
