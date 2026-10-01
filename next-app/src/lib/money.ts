const MAX_AMOUNT = 10_000_000;

export function normalizeAmount(value: unknown, label = 'Amount') {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > MAX_AMOUNT) {
    throw new Error(`${label} must be between ₹0.01 and ₹${MAX_AMOUNT.toLocaleString('en-IN')}.`);
  }

  const paise = Math.round(value * 100);
  if (!Number.isSafeInteger(paise) || Math.abs(value - paise / 100) > Number.EPSILON) {
    throw new Error(`${label} can have at most two decimal places.`);
  }

  return paise / 100;
}
