import { PublicKey, type VersionedTransactionResponse } from "@solana/web3.js";

export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

/**
 * SPEC.md §6-3: returns the UTF-8 payload of the first Memo-program
 * instruction, or null if the transaction has none. v1 carries at most one
 * attestation per transaction.
 */
export function extractMemoFromTransaction(tx: VersionedTransactionResponse): string | null {
  const message = tx.transaction.message;
  const accountKeys = message.getAccountKeys();
  for (const ix of message.compiledInstructions) {
    const programId = accountKeys.get(ix.programIdIndex);
    if (programId && programId.equals(MEMO_PROGRAM_ID)) {
      return Buffer.from(ix.data).toString("utf8");
    }
  }
  return null;
}

export interface PaymentInfo {
  mint: string;
  amount: number;
  uiAmount: number | null;
  recipient: string;
  /** Owner (wallet) of the receiving token account. SPEC.md §12 matches it against the attestation's pk. */
  recipientOwner: string | null;
  sender: string;
  slot: number;
  blockTime: number | null;
}

/**
 * SPEC.md §6-2: derives every incoming transfer of the mint purely from the
 * confirmed transaction's pre/post token balances, independent of what any
 * server claims.
 */
export function extractTokenReceipts(tx: VersionedTransactionResponse, mint: string): PaymentInfo[] {
  const pre = tx.meta?.preTokenBalances ?? [];
  const post = tx.meta?.postTokenBalances ?? [];
  const accountKeys = tx.transaction.message.getAccountKeys();

  const amountFor = (accountIndex: number, balances: typeof post) => {
    const bal = balances.find((b) => b.accountIndex === accountIndex && b.mint === mint);
    return bal ? BigInt(bal.uiTokenAmount.amount) : 0n;
  };

  const senderBal = post.find(
    (p) => p.mint === mint && BigInt(p.uiTokenAmount.amount) < amountFor(p.accountIndex, pre),
  );
  const sender = senderBal ? (accountKeys.get(senderBal.accountIndex)?.toBase58() ?? "unknown") : "unknown";

  const receipts: PaymentInfo[] = [];
  for (const postBal of post) {
    if (postBal.mint !== mint) continue;
    const delta = BigInt(postBal.uiTokenAmount.amount) - amountFor(postBal.accountIndex, pre);
    if (delta <= 0n) continue;
    receipts.push({
      mint,
      amount: Number(delta),
      uiAmount: Number(delta) / 10 ** postBal.uiTokenAmount.decimals,
      recipient: accountKeys.get(postBal.accountIndex)?.toBase58() ?? "unknown",
      recipientOwner: postBal.owner ?? null,
      sender,
      slot: tx.slot,
      blockTime: tx.blockTime ?? null,
    });
  }
  return receipts;
}

/** The purchase payment: the incoming transfer that is not the referral payout. */
export function extractPaymentFromTransaction(
  tx: VersionedTransactionResponse,
  mint: string,
  referralOwner?: string,
): PaymentInfo | null {
  return extractTokenReceipts(tx, mint).find((r) => !referralOwner || r.recipientOwner !== referralOwner) ?? null;
}

/** SPEC.md §12: the recommender's fee, i.e. the incoming transfer to an account owned by the attestation's pk. */
export function extractReferralPayout(
  tx: VersionedTransactionResponse,
  mint: string,
  referralOwner: string,
): PaymentInfo | null {
  return extractTokenReceipts(tx, mint).find((r) => r.recipientOwner === referralOwner) ?? null;
}
