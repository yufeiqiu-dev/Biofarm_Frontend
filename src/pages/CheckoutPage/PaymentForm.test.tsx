import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/*
 * The last screen before a card is charged, so the numbers on it are the ones
 * the customer consents to. It is also where a dead Pay button once lived: the
 * click returned silently when Stripe.js had loaded but the card form had not
 * mounted, so the buyer pressed it again and again with nothing happening.
 *
 * Stripe's hooks are mocked rather than the Elements provider, because the
 * component only ever reads whether they are ready and calls confirmPayment.
 */
const confirmPayment = vi.fn();
let stripeReady = true;
let elementsReady = true;

vi.mock('@stripe/react-stripe-js', () => ({
  PaymentElement: () => <div data-testid="card-form" />,
  useStripe: () => (stripeReady ? { confirmPayment } : null),
  useElements: () => (elementsReady ? {} : null),
}));

const { PaymentForm } = await import('./PaymentForm');

function renderForm(amounts: {
  subtotalCents?: number;
  taxAmountCents?: number;
  shippingAmountCents?: number;
} = {}) {
  const onBack = vi.fn();
  render(
    <PaymentForm
      clientSecret="cs_test"
      onBack={onBack}
      subtotalCents={amounts.subtotalCents ?? 2499}
      taxAmountCents={amounts.taxAmountCents ?? 271}
      shippingAmountCents={amounts.shippingAmountCents ?? 599}
    />,
  );
  return { onBack };
}

describe('PaymentForm', () => {
  beforeEach(() => {
    confirmPayment.mockReset().mockResolvedValue({});
    stripeReady = true;
    elementsReady = true;
  });

  it('charges the sum of the parts it displays', async () => {
    // 24.99 + 5.99 + 2.71. The button states the amount because that is what
    // pressing it does.
    renderForm();

    expect(screen.getByText('$24.99')).toBeInTheDocument();
    expect(screen.getByText('$5.99')).toBeInTheDocument();
    expect(screen.getByText('$2.71')).toBeInTheDocument();
    expect(screen.getByText('$33.69')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pay \$33\.69/i })).toBeInTheDocument();
  });

  it('rates the tax against goods plus shipping, which is what was taxed', () => {
    // calculate_tax passes the shipping cost to Stripe Tax because most US
    // states tax delivery; dividing by the goods alone rendered "10.84%".
    renderForm();

    expect(screen.getByText(/Tax \(8\.75%\)/)).toBeInTheDocument();
  });

  it('says shipping is free rather than showing nothing', () => {
    // A shipping line that only appears when it is charged leaves the customer
    // wondering whether it is coming later.
    renderForm({ shippingAmountCents: 0 });

    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  it('shows no tax rate rather than an impossible one', () => {
    // A zero-value basket would divide by zero; the parenthetical is dropped.
    renderForm({ subtotalCents: 0, shippingAmountCents: 0, taxAmountCents: 0 });

    expect(screen.queryByText(/Infinity|NaN/)).not.toBeInTheDocument();
    expect(screen.getByText('Tax')).toBeInTheDocument();
  });

  it('takes the payment when the form is ready', async () => {
    renderForm();

    await userEvent.click(screen.getByRole('button', { name: /pay/i }));

    expect(confirmPayment).toHaveBeenCalled();
  });

  it('does not offer a Pay button that would do nothing', async () => {
    /*
     * The card form has not mounted. handlePay returns silently in that state,
     * so an enabled button is a button that swallows clicks - the buyer presses
     * it repeatedly and concludes the shop is broken.
     */
    elementsReady = false;
    renderForm();

    expect(screen.getByRole('button', { name: /pay/i })).toBeDisabled();
    expect(screen.getByText(/payment form could not be loaded/i)).toBeInTheDocument();
    expect(confirmPayment).not.toHaveBeenCalled();
  });

  it('surfaces a refusal from Stripe instead of staying silent', async () => {
    confirmPayment.mockResolvedValue({ error: { message: 'Your card was declined.' } });
    renderForm();

    await userEvent.click(screen.getByRole('button', { name: /pay/i }));

    expect(await screen.findByText(/your card was declined/i)).toBeInTheDocument();
    // And the button comes back, so a declined card can be replaced.
    expect(screen.getByRole('button', { name: /pay/i })).toBeEnabled();
  });

  it('can go back to the review without paying', async () => {
    const { onBack } = renderForm();

    await userEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(onBack).toHaveBeenCalled();
    expect(confirmPayment).not.toHaveBeenCalled();
  });
});
