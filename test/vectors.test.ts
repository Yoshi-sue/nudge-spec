import { test } from "node:test";
import assert from "node:assert/strict";
import nacl from "tweetnacl";
import {
  canonicalMessage,
  decodeMemo,
  encodeMemo,
  signAttestation,
  verifyAttestation,
  type ReferralAttestation,
} from "../src/attestation.ts";

// SPEC.md §9
const SEED = Uint8Array.from({ length: 32 }, (_, i) => i);
const VECTOR: ReferralAttestation = {
  v: 1,
  rid: "ref-0001",
  m: "demo-merchant",
  p: "wireless-earbuds-x1",
  ts: 1759464000,
  sig: "35RMQQZkfwoXfNLZSCwuB3JJFnTwnTwH4FhsCQcxBqmxi2ZEPJdvrGG9H9fHhRRBK2ierMEooGH8GXzkochxykYC",
  pk: "FAe4sisG95oZ42w7buUn5qEE4TAnfTTFPiguZUHmhiF",
};

test("canonical message matches §9", () => {
  const msg = canonicalMessage(VECTOR);
  assert.equal(msg, "1|ref-0001|demo-merchant|wireless-earbuds-x1|1759464000");
  assert.equal(
    Buffer.from(msg).toString("hex"),
    "317c7265662d303030317c64656d6f2d6d65726368616e747c776972656c6573732d656172627564732d78317c31373539343634303030",
  );
});

test("signing with the fixed seed reproduces the vector exactly", () => {
  const { secretKey } = nacl.sign.keyPair.fromSeed(SEED);
  const { v: _v, sig: _s, pk: _p, ...cleartext } = VECTOR;
  assert.deepEqual(signAttestation(cleartext, secretKey), VECTOR);
});

test("the vector verifies", () => {
  assert.equal(verifyAttestation(VECTOR), true);
});

test("any change to a signed field invalidates it", () => {
  assert.equal(verifyAttestation({ ...VECTOR, ts: 1759464001 }), false);
  assert.equal(verifyAttestation({ ...VECTOR, rid: "ref-0002" }), false);
  assert.equal(verifyAttestation({ ...VECTOR, m: "demo-merchanT" }), false);
  assert.equal(verifyAttestation({ ...VECTOR, p: "wireless-earbuds-x2" }), false);
});

test("swapping in another public key invalidates it", () => {
  const other = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(7));
  const { pk } = signAttestation({ rid: "x", m: "y", p: "z", ts: 0 }, other.secretKey);
  assert.equal(verifyAttestation({ ...VECTOR, pk }), false);
});

test("memo round-trips and fits the 500-byte budget (234 bytes)", () => {
  const memo = encodeMemo(VECTOR);
  assert.equal(Buffer.byteLength(memo), 234);
  assert.deepEqual(decodeMemo(memo), VECTOR);
});

test("fields containing '|' are rejected on both sides (§3, §8-3)", () => {
  const { secretKey } = nacl.sign.keyPair.fromSeed(SEED);
  assert.throws(() => signAttestation({ rid: "a|b", m: "c", p: "d", ts: 0 }, secretKey));
  assert.equal(decodeMemo(JSON.stringify({ ...VECTOR, rid: "a|b" })), null);
});

test("unknown versions are not accepted (§11)", () => {
  assert.equal(decodeMemo(JSON.stringify({ ...VECTOR, v: 2 })), null);
});
