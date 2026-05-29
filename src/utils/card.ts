const CARD_BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  jcb: "JCB",
  diners: "Diners Club",
  unionpay: "UnionPay",
};

export function formatCardBrand(brand: string): string {
  return CARD_BRAND_LABELS[brand.toLowerCase()] ?? (brand.charAt(0).toUpperCase() + brand.slice(1));
}

export function formatCardDisplay(brand: string, last4: string): string {
  return `${formatCardBrand(brand)} ••••${last4}`;
}
