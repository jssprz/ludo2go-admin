export function proratePurchaseOrderDiscount(
  items: ReadonlyArray<{ quantity: number; unitCost: number }>,
  totalDiscount: number
): number[] {
  const amounts = items.map((item) => item.quantity * item.unitCost);
  const grossTotal = amounts.reduce((sum, amount) => sum + amount, 0);
  if (!Number.isSafeInteger(grossTotal) || !Number.isSafeInteger(totalDiscount) || totalDiscount < 0 || totalDiscount > grossTotal ||
      amounts.some((amount) => !Number.isSafeInteger(amount) || amount < 0)) {
    throw new Error('Discount must be a whole amount between zero and the items total');
  }
  if (grossTotal === 0) return amounts.map(() => 0);

  const shares = amounts.map((amount, index) => {
    const numerator = BigInt(totalDiscount) * BigInt(amount);
    return {
      index,
      discount: Number(numerator / BigInt(grossTotal)),
      remainder: numerator % BigInt(grossTotal),
    };
  });
  let remaining = totalDiscount - shares.reduce((sum, share) => sum + share.discount, 0);
  for (const share of [...shares].sort((a, b) =>
    a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1
  )) {
    if (remaining-- <= 0) break;
    share.discount += 1;
  }
  return shares.map((share) => share.discount);
}