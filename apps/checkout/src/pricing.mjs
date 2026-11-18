export function quote(quantity, coupon) {
  if (quantity !== 1) throw new Error('Quantity must be one');
  const subtotalCents = 10_000;
  const discountCents = String(coupon).trim().toUpperCase() === 'SAVE10' ? 1_000 : 0;
  return { subtotalCents, discountCents, totalCents: subtotalCents - discountCents };
}
