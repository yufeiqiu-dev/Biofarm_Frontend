import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/*
 * The last chance to check the order before a card is involved, so what it
 * lists has to be the basket as it stands.
 *
 * The cart hook is mocked rather than the provider: the step reads cartItems
 * and nothing else, and going through the provider would mean seeding
 * localStorage to assert an arithmetic sum.
 */
const cartItems = [
  { id: 'p1-v1', name: 'Anti-Tau (pS396)', sizeLabel: '50 ug', unitPrice: 285, quantity: 1 },
  { id: 'p2-v1', name: 'Amyloid-beta 42 ELISA', sizeLabel: '96 wells', unitPrice: 12.5, quantity: 4 },
];

vi.mock('../../context/useCartSideBar', () => ({
  useCartSideBar: () => ({ cartItems }),
}));

const { ReviewStep } = await import('./ReviewStep');

const contact = { name: 'Jane Smith', phone: '5551234567', email: 'jane@lab.edu' };
const shipping = {
  address1: '1 Research Park',
  address2: 'Suite 200',
  city: 'Springfield',
  state: 'IL',
  zip: '62701',
  notes: '',
};

function renderStep(loading = false) {
  const onBack = vi.fn();
  const onNext = vi.fn();
  render(
    <ReviewStep
      contact={contact}
      shipping={shipping}
      onBack={onBack}
      onNext={onNext}
      loading={loading}
    />,
  );
  return { onBack, onNext };
}

describe('ReviewStep', () => {
  beforeEach(() => vi.clearAllMocks());

  it('prices each line by quantity, not per unit', () => {
    // 12.50 x 4. A line showing the unit price next to a quantity of four is
    // the kind of thing a customer only notices on their statement.
    renderStep();

    expect(screen.getByText('$50.00')).toBeInTheDocument();
    expect(screen.getByText(/Amyloid-beta 42 ELISA.*4/)).toBeInTheDocument();
  });

  it('subtotals the whole basket', () => {
    // 285.00 + 50.00
    renderStep();

    expect(screen.getByText('$335.00')).toBeInTheDocument();
  });

  it('does not guess at tax it has not been told', () => {
    // Tax is computed server-side against the shipping address, at the point
    // the PaymentIntent is created - which has not happened yet on this step.
    renderStep();

    expect(screen.getByText(/calculated at payment/i)).toBeInTheDocument();
  });

  it('shows where the order is going, so a wrong address is catchable here', () => {
    renderStep();

    expect(screen.getByText(/1 Research Park/)).toBeInTheDocument();
    expect(screen.getByText(/Springfield/)).toBeInTheDocument();
  });

  it('goes back to the address without placing anything', async () => {
    const { onBack, onNext } = renderStep();

    await userEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(onBack).toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('cannot be submitted twice while the intent is being created', async () => {
    // This step's Continue is what calls createPaymentIntent. A second press
    // mid-flight is a second authorisation hold on the same basket.
    renderStep(true);

    const proceed = screen.getAllByRole('button').find((b) => !/back/i.test(b.textContent ?? ''));
    expect(proceed).toBeDisabled();
  });
});
