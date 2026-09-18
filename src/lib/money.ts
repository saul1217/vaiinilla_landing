const MONEY_PATTERN = /^(0|[1-9]\d*)\.\d{2}$/;

export function isValidMoney(value: string): boolean {
  return MONEY_PATTERN.test(value);
}

export function moneyToCents(value: string): bigint | null {
  if (!isValidMoney(value)) return null;
  const [pesos = '0', centavos = '00'] = value.split('.');
  return BigInt(pesos) * 100n + BigInt(centavos);
}

export function centsToMoney(value: bigint): string {
  const negative = value < 0n;
  const safe = negative ? -value : value;
  const formatted = `${safe / 100n}.${String(safe % 100n).padStart(2, '0')}`;
  return negative ? `-${formatted}` : formatted;
}

export function formatMoney(value: string): string {
  return `$${value} MXN`;
}

/** Android-style amount: `$73.70`, or `$22` when cents are zero. */
export function formatAmount(value: string, cents: 'trim' | 'always' = 'trim'): string {
  if (cents === 'always' || !value.endsWith('.00')) return `$${value}`;
  return `$${value.slice(0, -3)}`;
}

export function productUnitPreview(digitalPrice: string, extraPrices: string[]): string | null {
  const base = moneyToCents(digitalPrice);
  if (base === null) return null;
  let total = base;
  for (const extra of extraPrices) {
    const cents = moneyToCents(extra);
    if (cents === null) return null;
    total += cents;
  }
  return centsToMoney(total);
}

export function linePreview(unitPrice: string, quantity: number): string | null {
  const cents = moneyToCents(unitPrice);
  if (cents === null || quantity < 1) return null;
  return centsToMoney(cents * BigInt(quantity));
}

export function cartPreview(lineTotals: string[]): string | null {
  let total = 0n;
  for (const line of lineTotals) {
    const cents = moneyToCents(line);
    if (cents === null) return null;
    total += cents;
  }
  return centsToMoney(total);
}
