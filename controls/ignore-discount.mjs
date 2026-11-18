// Independent response-layer calibration fault. Never part of an agent proposal.
export function applyControl(result, mode) {
  if (mode === 'none') return result;
  if (mode !== 'ignore-discount') throw new Error('Unknown control');
  return { ...result, discountCents: 0, totalCents: result.subtotalCents };
}
