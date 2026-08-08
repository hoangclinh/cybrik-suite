# Trust-bundle lifecycle

Status: `ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED`

## Boundary

The bundle is public verification material for receipt signatures. Fabric creates and distributes
it; Suite defines only the interoperable document and fail-closed behavior. A verifier resolves
`kid` from a locally distributed bundle. It never follows `bundle_uri`, `jku`, `jwk`, `x5u`, or
any locator carried by an untrusted message.

## Generation and rotation

- `generation` is strictly increasing; successors identify the immediate predecessor.
- Every predecessor `kid` remains present in every successor. Removing one requires a future,
  separately accepted supersession design; receipt retention is additionally bounded by the
  retained trust-bundle horizon.
- One key may be `active`. Rotation first distributes a generation containing the new public key,
  then activates it, and moves the former key to `retiring` or `retired`.
- A replay verifies and returns the stored receipt. It never signs again with the new active key.

## Key states

The monotone state graph is:

```text
active -> retiring -> retired
   \          \          \
    +----------+-----------> revoked
```

`retiring` and `retired` keys cannot sign. A revoked entry is retained as a positive audit fact
and records time, reason, and prospective versus retroactive effect. Retroactive compromise may
invalidate a signature as authorization evidence, but the receipt and verification result remain
preserved for investigation.

## Freshness and compromise

The bundle declares an expiry and maximum staleness. Missing or stale local state fails closed for
new verification; it does not trigger a network fetch. A compromise response disables signing,
publishes a successor generation, records revocation, rotates the active key, and preserves all
affected receipts and prior bundle generations.

## Product decisions left to Fabric

Fabric selects the production HSM/KMS, signing authorization, key ceremony, distribution channel,
freshness operating value, retention period, and compromise runbook. Production credentials and
keys remain outside Suite and Founder-controlled production authority.
