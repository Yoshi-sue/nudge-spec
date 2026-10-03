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
  sender: string;
  slot: number;
  blockTime: number | null;
}

/**
 * SPEC.md §6-2: derives the payment purely from the confirmed transaction's
 * pre/post token balances, independent of what any server claims.
 */
export function extractPaymentFromTransaction(
  tx: VersionedTransactionResponse,
  mint: string,
): PaymentInfo | null {
  const pre = tx.meta?.preTokenBalances ?? [];
  const post = tx.meta?.postTokenBalances ?? [];
  const accountKeys = tx.transaction.message.getAccountKeys();

  const amountFor = (accountIndex: number, balances: typeof post) => {
    const bal = balances.find((b) => b.accountIndex === accountIndex && b.mint === mint);
    return bal ? BigInt(bal.uiTokenAmount.amount) : 0n;
  };

  for (const postBal of post) {
    if (postBal.mint !== mint) continue;
    const preAmount = amountFor(postBal.accountIndex, pre);
    const postAmount = BigInt(postBal.uiTokenAmount.amount);
    if (postAmount <= preAmount) continue;

    const senderBal = post.find((p) => {
      if (p.mint !== mint || p.accountIndex === postBal.accountIndex) return false;
      return BigInt(p.uiTokenAmount.amount) < amountFor(p.accountIndex, pre);
    });

    const delta = postAmount - preAmount;
    return {
      mint,
      amount: Number(delta),
      uiAmount: Number(delta) / 10 ** postBal.uiTokenAmount.decimals,
      recipient: accountKeys.get(postBal.accountIndex)?.toBase58() ?? "unknown",
      sender: senderBal ? (accountKeys.get(senderBal.accountIndex)?.toBase58() ?? "unknown") : "unknown",
      slot: tx.slot,
      blockTime: tx.blockTime ?? null,
    };
  }
  return null;
}
