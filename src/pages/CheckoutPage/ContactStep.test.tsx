import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContactStep } from './ContactStep';
import type { ContactForm } from './checkoutForms';

/*
 * The first step of the checkout wizard, on its own.
 *
 * Worth testing directly now that it is its own file: previously every one of
 * these assertions meant driving the whole page, so most of them were not made
 * at all - four tests covered a five-component wizard that builds a
 * PaymentIntent.
 */
function renderStep(contact: Partial<ContactForm> = {}) {
  const onChange = vi.fn();
  const onNext = vi.fn();
  render(
    <ContactStep
      contact={{ name: '', phone: '', email: '', ...contact }}
      onChange={onChange}
      onNext={onNext}
    />,
  );
  return { onChange, onNext };
}

const complete = { name: 'Jane Smith', phone: '5551234567', email: 'jane@lab.edu' };

describe('ContactStep', () => {
  it('will not continue until every field is filled', async () => {
    renderStep();

    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it.each([
    ['name', { ...complete, name: '' }],
    ['phone', { ...complete, phone: '' }],
    ['email', { ...complete, email: '' }],
  ])('will not continue with %s missing', (_field, contact) => {
    renderStep(contact);

    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('does not accept whitespace as a name or phone', () => {
    // The guard trims, so " " must not read as filled in.
    renderStep({ ...complete, name: '   ', phone: '   ' });

    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('continues once all three are valid', async () => {
    const { onNext } = renderStep(complete);

    const button = screen.getByRole('button', { name: /continue/i });
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(onNext).toHaveBeenCalled();
  });

  it('rejects an address with no @ or no dot', () => {
    // Enough to catch a typo and no more - nothing short of sending to an
    // address proves it is real. This only stops an obvious mistake reaching a
    // confirmation nobody receives.
    renderStep({ ...complete, email: 'jane-at-lab' });

    expect(screen.getByText(/enter a valid email address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('says nothing about validity before anything is typed', () => {
    // An error on an untouched field reads as the form being broken.
    renderStep();

    expect(screen.queryByText(/enter a valid email address/i)).not.toBeInTheDocument();
    expect(screen.getByText(/order confirmations will be sent here/i)).toBeInTheDocument();
  });

  it('lets the customer send order mail somewhere else', async () => {
    /*
     * The field is editable, deliberately. It used to be disabled and showed
     * the Cognito account address, which blocked checkout outright for an
     * account with no email and gave a lab ordering against a shared purchasing
     * address no way to say so.
     */
    const { onChange } = renderStep(complete);

    const email = screen.getByLabelText(/email/i);
    expect(email).toBeEnabled();
    await userEvent.type(email, 'x');

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'jane@lab.edux', name: 'Jane Smith' }),
    );
  });
});
