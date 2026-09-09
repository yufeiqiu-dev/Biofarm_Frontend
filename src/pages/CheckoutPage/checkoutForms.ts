/**
 * What the checkout wizard collects, and the constants its steps share.
 *
 * Separate from the page because the four steps are now four files: leaving
 * these in the page would make every step import from the component that
 * renders it, which is the wrong direction and a cycle waiting to happen.
 */

export type ContactForm = { name: string; phone: string; email: string };

export type ShippingForm = {
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
};

/*
 * Enough to catch a typo, and no more. Nothing short of sending to an address
 * proves it is real, so this only exists to stop an obvious mistake reaching a
 * confirmation email nobody receives. The backend applies the same rule.
 */
export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const STEP_LABELS = ["Contact", "Shipping", "Review", "Payment"];

export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];
