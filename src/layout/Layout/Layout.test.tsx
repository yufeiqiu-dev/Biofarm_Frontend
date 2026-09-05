import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { Layout } from './Layout';
import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * The bug: <main> was offset from the fixed navbar by
 * `paddingTop: 15 + \`${navbarHeight}px\`` - a number added to a string, so it
 * produced "150px" rather than 15 + navbarHeight.
 *
 * It survived because a second bug cancelled it. The ResizeObserver watched a
 * wrapper div whose only child is `position: fixed`, so the wrapper measured 0
 * forever, and "15" + "0px" happens to land near the real navbar height. At the
 * default text size that left one pixel of clearance on a phone; at a 20px root
 * font it left the navbar covering 47px of the page.
 *
 * jsdom does no layout, so the height itself cannot be asserted here. What can
 * be asserted is that the offset is no longer computed in JavaScript at all.
 */
describe('Layout', () => {
  it('does not position the content with an inline padding calculation', () => {
    renderWithProviders(<Layout />);

    const main = screen.getByRole('main');

    expect(main.style.paddingTop).toBe('');
    expect(main.getAttribute('style')).toBeNull();
  });
});
