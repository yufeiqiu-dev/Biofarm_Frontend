import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import { ScrollToTop } from './ScrollToTop';

/**
 * Nothing reset the scroll position between routes, so it simply carried over.
 * Reaching the bottom of a product page and clicking Home left you at that
 * offset, which meant the dark footer was what was on screen while the new page
 * rendered - reported as a brief dark flash on the way to the home and products
 * pages. Measured per animation frame: 27-54% of the viewport dark, down to 4%
 * once the scroll resets.
 */
describe('ScrollToTop', () => {
  let scrollTo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
  });

  afterEach(() => vi.unstubAllGlobals());

  const app = (initial: string) => (
    <MemoryRouter initialEntries={[initial]}>
      <ScrollToTop />
      <Routes>
        <Route
          path="/products"
          element={
            <>
              <Link to="/">Home</Link>
              <Link to="/products?tag=standards">Filter</Link>
            </>
          }
        />
        <Route path="/" element={<p>home</p>} />
      </Routes>
    </MemoryRouter>
  );

  it('goes to the top when the path changes', async () => {
    render(app('/products'));
    scrollTo.mockClear();

    await userEvent.click(document.querySelector('a[href="/"]') as HTMLElement);

    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('stays put when only the query string changes', async () => {
    // The listing filters by writing ?tag= into the query string. Yanking
    // someone to the top when they tick a filter is its own small hostility.
    render(app('/products'));
    scrollTo.mockClear();

    await userEvent.click(
      document.querySelector('a[href="/products?tag=standards"]') as HTMLElement,
    );

    expect(scrollTo).not.toHaveBeenCalled();
  });
});
