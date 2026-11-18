// Seeded application-source regression, separate from calibration control.
export function quote(quantity, coupon) {
  if (quantity !== 1) throw new Error('Quantity must be one');
  const subtotalCents = 10_000;
  const discountCents = 0;
  return { subtotalCents, discountCents, totalCents: subtotalCents - discountCents };
}
