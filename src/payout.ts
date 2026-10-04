// SPEC.md §12: the merchant declares referralFeeBps; rounding goes to the merchant.
export interface PurchaseSplit {
  merchantAmount: number;
  referralAmount: number;
}

export function computeSplit(amount: number, referralFeeBps: number, hasReferral: boolean): PurchaseSplit {
  if (!hasReferral || referralFeeBps <= 0) return { merchantAmount: amount, referralAmount: 0 };
  const referralAmount = Math.floor((amount * referralFeeBps) / 10_000);
  return { merchantAmount: amount - referralAmount, referralAmount };
}
