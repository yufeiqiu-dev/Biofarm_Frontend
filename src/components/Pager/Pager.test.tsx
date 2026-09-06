import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pager } from './Pager';

describe('Pager', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
  });

  it('stays on screen while the next page is loading', async () => {
    // The controls used to be removed from the DOM on every page turn, because
    // the caller zeroed the total while a request was in flight and this
    // renders nothing at one page. That destroyed keyboard focus on "Next" and
    // made `busy` meaningless - the buttons were not disabled, they were gone.
    const { rerender } = render(
      <Pager page={0} pageSize={10} total={30} onPage={vi.fn()} label="Pages" />,
    );
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();

    rerender(
      <Pager page={1} pageSize={10} total={30} onPage={vi.fn()} label="Pages" busy />,
    );

    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });

  it('goes back to the top of the list when the page changes', async () => {
    // The controls sit below the list, so without this the next page arrives
    // with its last rows under the cursor.
    const onPage = vi.fn();
    render(<Pager page={0} pageSize={10} total={30} onPage={onPage} label="Pages" />);

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(onPage).toHaveBeenCalledWith(1);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });

  it('renders nothing when everything fits on one page', () => {
    const { container } = render(
      <Pager page={0} pageSize={10} total={10} onPage={vi.fn()} label="Pages" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('reports the range it is showing', () => {
    render(<Pager page={1} pageSize={10} total={26} onPage={vi.fn()} label="Pages" />);
    expect(screen.getByText('11–20 of 26')).toBeInTheDocument();
  });

  it('does not offer a page past the end', () => {
    render(<Pager page={2} pageSize={10} total={26} onPage={vi.fn()} label="Pages" />);
    expect(screen.getByText('21–26 of 26')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});
