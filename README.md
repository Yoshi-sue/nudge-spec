# Nudge Referral Attestation

**Sign off-chain, carry on-chain, verify off-chain.**

An open format for proving *which recommendation led to a purchase* — by carrying a recommender's Ed25519-signed claim inside the **same Solana transaction** as the payment (via the SPL Memo program), so that anyone can verify it from the chain alone, without asking the merchant or any operator.

Built for agentic commerce: when an AI agent pays (e.g. over x402), there is no cookie, no click, and no human session to attribute. The payer itself declares, under its own transaction signature, which recommendation it is acting on.

- **Spec:** [SPEC.md](SPEC.md) (v1 draft, Japanese; English translation planned)
- **Live verifier (devnet):** https://nudge-sigma-lime.vercel.app/
- **Status:** v1 draft. Known limitations are listed in SPEC.md §8 — read them before using this for real payouts.

---

## 日本語

AIエージェントが購買したとき、**「どの推薦による購買だったか」を、決済と同じトランザクションに載せて、誰でも独立に検証できるようにする**ための形式です。

推薦者が Ed25519 で署名した短い JSON（アテステーション）を、支払者が決済トランザクションの Memo 命令に入れて送ります。
検証者はトランザクションを取得し、送金とアテステーションを取り出して署名を確かめます。マーチャントにも運営者にも問い合わせる必要はありません。

**このリポジトリは仕様と最小の参照実装だけを置いています。** 推薦の配分ポリシー（複数の推薦者に誰がいくら払うか）は範囲外で、上位のレイヤーが持つ前提です（SPEC.md §10）。

## Try it

```bash
npm install
```

```bash
npm test
```

```bash
npm run verify-tx -- teoahLGnD98H2tZoFjFNNfFujEF8JZ1y6KKjFAYVsT3zJraeTRoHqntFJwpRfMceK4xj6cjAYcw4JdgAniTqqSY
```

`npm test` は SPEC.md §9 のテストベクタを検証します。別の言語で実装した場合も、同じシードから同じ `sig` が得られれば署名部分は互換です。

## Feedback

仕様への指摘・質問は Issue へ。とくに次の点について意見を探しています。

- 同じアテステーションを複数の購買に使うことを、どこまで許すべきか（§8-1）
- 複数の推薦者の寄与をどう表すか（§8-4）
- `m` を支払先アドレスに縛るべきか（§7）
- 推薦の中身をどこまで公開してよいか。誰でも検証できることとプライバシーを、どう両立させるか（§7, §8-6）
- ゼロ知識証明が必要になる相手や場面はあるか。今はコミットメントで足りると考えている（§8-6）

## License

Apache-2.0
