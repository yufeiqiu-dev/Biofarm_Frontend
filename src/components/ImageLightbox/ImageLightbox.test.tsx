import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageLightbox } from './ImageLightbox';

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
});
