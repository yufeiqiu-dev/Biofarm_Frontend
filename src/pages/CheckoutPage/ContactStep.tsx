import { EMAIL_PATTERN } from "./checkoutForms";
import type { ContactForm } from "./checkoutForms";
import styles from "./CheckoutPage.module.css";

export function ContactStep({
  contact,
  onChange,
  onNext,
}: {
  contact: ContactForm;
  onChange: (v: ContactForm) => void;
  onNext: () => void;
}) {
  const emailValid = EMAIL_PATTERN.test(contact.email.trim());
  const emailTouched = contact.email.trim().length > 0;

  return (
    <div className={styles.card}>
      <h2>Contact Information</h2>
      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="checkout-email">Email *</label>
        <input
          id="checkout-email"
          type="email"
          className={styles.input}
          value={contact.email}
          onChange={(e) => onChange({ ...contact, email: e.target.value })}
          placeholder="purchasing@lab.edu"
        />
        {/*
          Editable, and prefilled with the account address. It used to be
          disabled, which meant an account with no email could not check out at
          all, and a lab ordering against a shared purchasing address had no way
          to say so. Order mail is a notification rather than a credential -
          every order is scoped by the Cognito sub, and knowing an address
          reaches nothing - so the customer's word is good enough for where it
          goes.
        */}
        {emailTouched && !emailValid ? (
          <p className={styles.fieldError}>Enter a valid email address.</p>
        ) : (
          <p className={styles.fieldHint}>Order confirmations will be sent here.</p>
        )}
      </div>
      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="checkout-full-name">Full Name *</label>
        <input
          id="checkout-full-name"
          className={styles.input}
          value={contact.name}
          onChange={(e) => onChange({ ...contact, name: e.target.value })}
          placeholder="Jane Smith"
        />
      </div>
      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="checkout-phone">Phone *</label>
        <input
          id="checkout-phone"
          className={styles.input}
          value={contact.phone}
          onChange={(e) => onChange({ ...contact, phone: e.target.value })}
          placeholder="5551234567"
        />
      </div>
      <div className={styles.actions}>
        <button
          className={styles.btnPrimary}
          onClick={onNext}
          disabled={!emailValid || !contact.name.trim() || !contact.phone.trim()}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
