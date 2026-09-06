import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageLightbox } from './ImageLightbox';
import { DEFAULT_PRODUCT_IMAGE } from '../../constants/product';

const images = ['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg', 'https://cdn.test/c.jpg'];

function open(index = 0, onIndexChange = vi.fn(), onClose = vi.fn()) {
  render(
    <ImageLightbox
      images={images}
      index={index}
      onIndexChange={onIndexChange}
      onClose={onClose}
      productName="Anti-Tau"
    />,
  );
  return { onIndexChange, onClose };
}

describe('ImageLightbox', () => {
  it('says which image is being shown', () => {
    open(1);
    expect(screen.getByText('2 of 3')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const { onClose } = open();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('moves between images with the arrow keys', async () => {
    const { onIndexChange } = open(0);
    await userEvent.keyboard('{ArrowRight}');
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it('wraps around rather than stopping at the ends', async () => {
    // Reaching the last image and pressing right again should return to the
    // first, not silently do nothing.
    const { onIndexChange } = open(2);
    await userEvent.keyboard('{ArrowRight}');
    expect(onIndexChange).toHaveBeenCalledWith(0);
  });

  it('goes back from the first image to the last', async () => {
    const { onIndexChange } = open(0);
    await userEvent.keyboard('{ArrowLeft}');
    expect(onIndexChange).toHaveBeenCalledWith(2);
  });

  it('closes when the backdrop is clicked but not when the image is', async () => {
    // Clicking the picture itself must not dismiss it - that is where someone
    // looking closely at a blot will click.
    const { onClose } = open();
    await userEvent.click(screen.getByRole('img'));
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalled();
  });

  it('takes focus so the keyboard shortcuts reach it', () => {
    open();
    expect(screen.getByRole('button', { name: /close image viewer/i })).toHaveFocus();
  });

  it('is a modal dialog, named for what it is showing', () => {
    open(1);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Anti-Tau, image 2 of 3');
  });

  it('stops the page behind it from scrolling, and restores it on close', () => {
    const { unmount } = render(
      <ImageLightbox images={images} index={0} onIndexChange={vi.fn()} onClose={vi.fn()} productName="Anti-Tau" />,
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('offers no stepping arrows for a single image', () => {
    render(
      <ImageLightbox images={[images[0]]} index={0} onIndexChange={vi.fn()} onClose={vi.fn()} productName="Anti-Tau" />,
    );
    expect(screen.queryByRole('button', { name: /next image/i })).not.toBeInTheDocument();
  });

  it('keeps Tab inside the viewer', async () => {
    // aria-modal only tells a screen reader the rest of the page is inert. A
    // sighted keyboard user would otherwise tab past the last arrow into the
    // variant radios and "Add to cart" behind the backdrop, and activate a
    // control they cannot see.
    open(0);
    const close = screen.getByRole('button', { name: 'Close image viewer' });
    const next = screen.getByRole('button', { name: 'Next image' });

    next.focus();
    await userEvent.keyboard('{Tab}');
    expect(close).toHaveFocus();

    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(next).toHaveFocus();
  });

  it('falls back to the placeholder when the full-size image is missing', () => {
    // The page image behind falls back the same way, so without this the
    // shopper sees a normal placeholder, clicks it, and gets a broken glyph on
    // a near-black backdrop.
    open(0);
    const img = screen.getByRole('img');
    fireEvent.error(img);
    expect(img).toHaveAttribute('src', DEFAULT_PRODUCT_IMAGE);
  });

  it('does not loop when the placeholder itself fails', () => {
    open(0);
    const img = screen.getByRole('img');
    fireEvent.error(img);
    fireEvent.error(img);
    expect(img).toHaveAttribute('src', DEFAULT_PRODUCT_IMAGE);
  });
});
