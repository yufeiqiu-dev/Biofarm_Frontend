import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShippingStep } from './ShippingStep';
import type { ShippingForm } from './checkoutForms';

const complete: ShippingForm = {
  address1: '1 Research Park',
  address2: '',
  city: 'Springfield',
  state: 'IL',
  zip: '62701',
  notes: '',
};

function renderStep(shipping: Partial<ShippingForm> = {}) {
  const onChange = vi.fn();
  const onBack = vi.fn();
  const onNext = vi.fn();
  render(
    <ShippingStep
      shipping={{ ...complete, ...shipping }}
      onChange={onChange}
      onBack={onBack}
      onNext={onNext}
    />,
  );
  return { onChange, onBack, onNext };
}

/*
 * The address the order ships to. Everything here gates the Continue button,
 * and getting that wrong in either direction is expensive: too strict and a
 * paying customer cannot proceed, too loose and a package goes nowhere.
 */
describe('ShippingStep', () => {
  it('continues when the address is complete', async () => {
    const { onNext } = renderStep();

    const button = screen.getByRole('button', { name: /continue/i });
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(onNext).toHaveBeenCalled();
  });

  it.each([
    ['street', { address1: '' }],
    ['city', { city: '' }],
    ['state', { state: '' }],
    ['postcode', { zip: '' }],
  ])('will not continue without a %s', (_field, missing) => {
    renderStep(missing);

    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('does not accept whitespace as an address', () => {
    // The guard trims, so a field of spaces must not read as filled in.
    renderStep({ address1: '   ', city: '  ', zip: ' ' });

    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('continues without the optional lines', () => {
    // Line 2 and delivery notes are genuinely optional; requiring them would
    // block anyone without a suite number.
    renderStep({ address2: '', notes: '' });

    expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();
  });

  it('can go back to fix the contact details', async () => {
    const { onBack } = renderStep();

    await userEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(onBack).toHaveBeenCalled();
  });

  it('reports an edit without dropping the other fields', async () => {
    const { onChange } = renderStep();

    await userEvent.type(screen.getByLabelText(/address line 2/i), 'B');

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ address2: 'B', city: 'Springfield', zip: '62701' }),
    );
  });
});
