import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminProductCard } from './AdminProductCard';
import { renderWithProviders } from '../../test/renderWithProviders';
import { createMockProduct } from '../../test/mocks/mockProduct';

const product = createMockProduct({ id: 'product-1', name: 'Test Product' });

describe('AdminProductCard', () => {
  it('calls onToggle with the product id when the row body is clicked', async () => {
    const onToggle = vi.fn();
    renderWithProviders(
      <AdminProductCard product={product} checked={false} onToggle={onToggle} />
    );
    await userEvent.click(screen.getByText('Test Product'));
    expect(onToggle).toHaveBeenCalledOnce();
    expect(onToggle).toHaveBeenCalledWith('product-1');
  });

  it('calls onToggle exactly once when the checkbox is clicked (no double-fire)', async () => {
    const onToggle = vi.fn();
    renderWithProviders(
      <AdminProductCard product={product} checked={false} onToggle={onToggle} />
    );
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('does not call onToggle when the Edit button is clicked', async () => {
    const onToggle = vi.fn();
    renderWithProviders(
      <AdminProductCard product={product} checked={false} onToggle={onToggle} />
    );
    await userEvent.click(screen.getByRole('link', { name: 'Edit' }));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('applies rowSelected class when checked is true', () => {
    renderWithProviders(
      <AdminProductCard product={product} checked={true} onToggle={vi.fn()} />
    );
    const row = screen.getByRole('checkbox').closest('[class*="row"]')!;
    expect(row.className).toMatch(/rowSelected/);
  });

  it('does not apply rowSelected class when checked is false', () => {
    renderWithProviders(
      <AdminProductCard product={product} checked={false} onToggle={vi.fn()} />
    );
    const row = screen.getByRole('checkbox').closest('[class*="row"]')!;
    expect(row.className).not.toMatch(/rowSelected/);
  });
});
