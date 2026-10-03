import nacl from "tweetnacl";
import bs58 from "bs58";
import { z } from "zod";

// SPEC.md §5: the memo must stay at or under 500 bytes, leaving room for the
// transfer instruction's account keys within Solana's 1,232-byte tx limit.
export const MAX_MEMO_BYTES = 500;

// SPEC.md §3: "|" is the field separator in the canonical message, so allowing
// it inside a field would let two different claims produce the same bytes.
const Field = z.string().min(1).regex(/^[^|]*$/, "must not contain '|'");

export const ReferralAttestationCleartextSchema = z.object({
  v: z.literal(1),
  rid: Field,
  m: Field,
  p: Field,
  ts: z.number().int().nonnegative(),
});

export type ReferralAttestationCleartext = z.infer<typeof ReferralAttestationCleartextSchema>;

export const ReferralAttestationSchema = ReferralAttestationCleartextSchema.extend({
  sig: z.string().min(1),
  pk: z.string().min(1),
});

export type ReferralAttestation = z.infer<typeof ReferralAttestationSchema>;

// SPEC.md §4: pipe-delimited, fixed field order. Signer and verifier each
// rebuild this independently, so JSON key order never matters.
export function canonicalMessage(c: ReferralAttestationCleartext): string {
  return `${c.v}|${c.rid}|${c.m}|${c.p}|${c.ts}`;
}

/**
 * Signs a referral claim. `secretKey` is a 64-byte Ed25519 secret key
 * (seed + public key), the same layout as a Solana keypair file.
 */
export function signAttestation(
  cleartext: Omit<ReferralAttestationCleartext, "v">,
  secretKey: Uint8Array,
): ReferralAttestation {
  const full = ReferralAttestationCleartextSchema.parse({ v: 1, ...cleartext });
  const message = new TextEncoder().encode(canonicalMessage(full));
  const signature = nacl.sign.detached(message, secretKey);
  const publicKey = nacl.sign.keyPair.fromSecretKey(secretKey).publicKey;
  return { ...full, sig: bs58.encode(signature), pk: bs58.encode(publicKey) };
}

export function verifyAttestation(attestation: ReferralAttestation): boolean {
  const message = new TextEncoder().encode(canonicalMessage(attestation));
  try {
    const signature = bs58.decode(attestation.sig);
    const publicKey = bs58.decode(attestation.pk);
    return nacl.sign.detached.verify(message, signature, publicKey);
  } catch {
    return false;
  }
}

export function encodeMemo(attestation: ReferralAttestation): string {
  const json = JSON.stringify(attestation);
  const byteLength = new TextEncoder().encode(json).length;
  if (byteLength > MAX_MEMO_BYTES) {
    throw new Error(`attestation memo is ${byteLength} bytes, exceeds ${MAX_MEMO_BYTES}-byte budget`);
  }
  return json;
}

/** Returns null when the memo is not a well-formed v1 attestation (SPEC.md §6-4). */
export function decodeMemo(memo: string): ReferralAttestation | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(memo);
  } catch {
    return null;
  }
  const result = ReferralAttestationSchema.safeParse(parsed);
  return result.success ? result.data : null;
}
