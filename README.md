# Nouns Builder Passport

EAS × Propdates — fully on-chain builder reputation for Nouns DAO.

## Contracts

| Contract | Role |
|---|---|
| `NounsPassportResolver` | Schema 1 resolver + passport issuer. The main contract. |
| `PropUpdateResolver` | Lightweight Schema 1 resolver (reference/fallback). |
| `NounHolderResolver` | Schema 2 resolver — live Noun balance check + one-per-holder enforcement. |

## Live addresses (post-deploy — fill in after running DeployPassport.s.sol)

```
NounsPassportResolver: 0xc73b1fe64638fe415db2985a4a3b1f0bebaafd33
PropUpdateResolver:    0x4960e774ad4290eab05df6dea277fef0c1a26125
NounHolderResolver:    0xc0edb7b49409936385da7bb623ca3c50482cfdf0
Schema 1 UID:          
Schema 2 UID:          
Schema 3 UID:          
```

## Setup

```bash
# Install Foundry if needed
curl -L https://foundry.paradigm.xyz | bash && foundryup

# Clone and install deps
git clone <this-repo>
cd nouns-builder-passport
forge install ethereum-attestation-service/eas-contracts
forge install OpenZeppelin/openzeppelin-contracts
forge install foundry-rs/forge-std
```

## Test

```bash
forge test -vvv
```

## Deploy (mainnet)

```bash
cp .env.example .env
# Fill in MAINNET_RPC, PRIVATE_KEY, ETHERSCAN_API_KEY

forge script script/DeployPassport.s.sol \
  --rpc-url $MAINNET_RPC \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify
```

## Bootstrap historical props

After deploying, builders with pre-existing completed propdates can attest
their history:

1. Open `script/BootstrapHistoricalProps.s.sol`
2. Fill in your `propIds`, `txHashes`, `titles`, and `evidenceURIs` arrays
3. Run:

```bash
export SCHEMA_1_UID=<from deploy output>

forge script script/BootstrapHistoricalProps.s.sol \
  --rpc-url $MAINNET_RPC \
  --private-key $PRIVATE_KEY \
  --broadcast
```

## How it works

### Schema 1 — Milestone attestation
Builder calls `EAS.attest()` with a propId, milestone title, evidence URI,
isFinal flag, and the original Propdates tx hash. `NounsPassportResolver`
verifies the attester is `propUpdateAdmin` on the live Propdates contract,
then auto-mints or refreshes the builder's Schema 3 passport in the same tx.

### Schema 2 — Peer verification
Any live Noun holder calls `EAS.attest()` referencing a Schema 1 milestone UID.
`NounHolderResolver` checks `NounsToken.balanceOf(msg.sender) >= 1` and
enforces one attestation per holder per milestone.

### Schema 3 — Builder Passport
Issued automatically by `NounsPassportResolver` — never signed directly by
the builder. Contains: totalProps, completedProps, totalMilestones,
peerVerifications, avgDaysBetweenUpdates, passportVersion.

Recipient is the builder's wallet address, making it portable. Any gate
reads it via:
```solidity
IEAS.getAttestation(schema3UID, builderAddress)
```

## Architecture notes

- All truth sourced from live Propdates contract state — no off-chain indexers
  needed for gating
- Builder milestone array stored in `NounsPassportResolver` — fully on-chain,
  O(n) read where n = milestone count (bounded ~20 for active builders)
- Reentrancy guard on `onAttest` — EAS callback back into `EAS.attest()` for
  Schema 3 issuance is safe but guarded explicitly
- Schema 1 is non-revocable; Schema 2 is revocable; Schema 3 is revocable
  (superseded by new versions)

## Gas estimates (at 0.105 Gwei)

| Operation | Est. gas | Est. cost |
|---|---|---|
| Schema 1 attestation (new milestone) | ~120k | ~$0.03 |
| Schema 1 attestation (isFinal, triggers passport mint) | ~200k | ~$0.05 |
| Schema 1 attestation (isFinal, triggers passport refresh) | ~240k | ~$0.06 |
| Schema 2 peer verification | ~65k | ~$0.015 |
