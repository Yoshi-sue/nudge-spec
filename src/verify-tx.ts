import { parseArgs } from "node:util";
import { Connection } from "@solana/web3.js";
import { decodeMemo, verifyAttestation } from "./attestation.ts";
import { extractMemoFromTransaction, extractPaymentFromTransaction, extractReferralPayout } from "./solana.ts";

// Circle's devnet USDC, used by the public demo.
const DEVNET_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    rpc: { type: "string", default: "https://api.devnet.solana.com" },
    mint: { type: "string", default: DEVNET_USDC_MINT },
  },
});

const signature = positionals[0];
if (!signature) {
  console.error("Usage: verify-tx <tx signature> [--rpc <url>] [--mint <token mint>]");
  process.exit(1);
}

const connection = new Connection(values.rpc!, "confirmed");
const tx = await connection.getTransaction(signature, {
  commitment: "confirmed",
  maxSupportedTransactionVersion: 0,
});
if (!tx) {
  console.error("transaction not found (not confirmed yet, wrong cluster, or does not exist)");
  process.exit(1);
}

const memo = extractMemoFromTransaction(tx);
const referral = memo ? decodeMemo(memo) : null;
const referralSignatureValid = referral ? verifyAttestation(referral) : false;

// SPEC.md §12: a payout only counts when it goes to the signer of a valid attestation.
const payment = extractPaymentFromTransaction(tx, values.mint!, referral?.pk);
const referralPayout =
  referral && referralSignatureValid ? extractReferralPayout(tx, values.mint!, referral.pk) : null;

console.log(
  JSON.stringify(
    {
      signature,
      payment,
      referral,
      referralPayout,
      verified: {
        paymentFound: payment !== null,
        referralSignatureValid,
        referralPaidInSameTx: referralPayout !== null,
      },
    },
    null,
    2,
  ),
);

if (!payment || !referralSignatureValid) process.exit(1);
