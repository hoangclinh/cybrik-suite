# Founder Decision Packet — Deployment priority and provider policy

- Status: `DECIDED — RECORDED` (Founder, 2026-08-23). This packet records a Founder policy
  decision. It is **not** an ADR acceptance and flips no ADR status.
- Authority: **FOUNDER**
- Decision date: **2026-08-23**
- Recorded: 2026-08-23, transcribed under explicit Founder directive by an AI agent acting solely
  as recording agent. No Founder signature, cryptographic signature or acceptance receipt is
  synthesized or implied; the Git commit containing this file is its durable identity.
- Decision scope: `DEPLOYMENT_PRIORITY_AND_PROVIDER_POLICY_ONLY`
- Release impact: none. This packet changes no W0–W6 date, certifies no runtime, and opens no gate.
- Related: [ADR-0015](ADR-0015-deployment-priority-sovereignty-and-provider-neutral-boundary.md)
  (`PROPOSED` — **not accepted by this packet**)

This packet exists because the policy below previously had no Git-identity-bound home in any
suite repository. It was recorded only in a derived controller working directory that is not under
version control. This packet is now the authoritative provenance for that policy.

## 1. Recorded Founder decision

### 1.1 Historical architecture — dated finding, not this decision

```
HISTORICAL_DEPLOYMENT_ARCHITECTURE = PROVIDER_NEUTRAL_WITH_ON_PREM_FIRST_CLASS
```

This describes what the repositories already recorded before 2026-08-23. It is dated provenance and
is not altered by this packet.

### 1.2 New Founder deployment policy — effective 2026-08-23

```
NEW_FOUNDER_DEPLOYMENT_POLICY:

  P1 = ON_PREMISE
  P2 = PRIVATE_CLOUD
  P3 = SOVEREIGN_CONTROLLED_CROSS_DOMAIN_OR_OPTIONAL_HYBRID

  FOREIGN_PUBLIC_CLOUD = DEFERRED_OPTIONAL_DEPLOYMENT_PROFILE
```

### 1.3 AWS disposition

```
AWS_PRIMARY_FOUNDER_AUTHORITY   = NOT_FOUND
AWS_PRIMARY_DEPLOYMENT_DECISION = VOID_UNRATIFIED_DERIVED_DRIFT
```

### 1.4 Substrate status — undecided

```
KUBERNETES_PRIMARY_SUBSTRATE = UNDECIDED
VIRTUALIZATION_SUBSTRATE     = UNDECIDED
```

### 1.5 Production authority

```
PRODUCTION_DEPLOYMENT_AUTHORITY = CLOSED
```

## 2. Mandatory reading constraints

1. **This is a new Founder policy dated 2026-08-23.** It MUST NOT be backdated into historical
   architecture, and no historical document may be rewritten to claim it was already binding.
   §1.1 and §1.2 are separate statements about separate periods.
2. **This packet does not accept ADR-0015.** ADR-0015 remains `PROPOSED`, Decider `FOUNDER`.
   Acceptance is a separate status transition requiring independent review and explicit Founder
   authority.
3. **This packet selects no technology.** It does not select Kubernetes, RKE2, K3s, OpenShift,
   VMware, Proxmox, OpenStack, AWS, GCP, Azure, or any other implementation substrate or provider.
   Every candidate remains `NOT_SELECTED` and both substrate questions remain `UNDECIDED`.
4. **This packet grants no production rollout authority.** `PRODUCTION_DEPLOYMENT_AUTHORITY` is
   `CLOSED`.
5. **This packet authorizes no implementation.** It authorizes no Platform Contract work, no
   dependency change, no migration, no provisioning, no deployment, no release, and no cleanup or
   deletion of existing AWS artifacts.
6. **AWS is not banned.** The disposition in §1.3 is that AWS-primary was never Founder-authorized,
   not that AWS is forbidden. A future provider adapter remains possible under a separate decision.
7. **Scope is exhaustive.** Only the statements in §1 are decided. No policy beyond them is
   recorded, implied, or may be inferred from this packet.

## 3. Provenance and durability

- The **authoritative provenance** of this policy is this file, identified by the Git commit that
  introduces it in `cybrik-suite`.
- `soc-autonomous-state:CURRENT_STATE.json` previously carried the only written form of this
  policy. That working directory is **not a Git repository**, so it carries no commit identity and
  cannot be pinned. From this packet onward it is classified
  `NON_AUTHORITATIVE_OPERATIONAL_MIRROR` and MUST NOT be cited as the authority for this policy.
  A divergence between that mirror and this packet resolves in favour of this packet.
- Transcription fidelity: §1 records the Founder directive verbatim in substance. The recording
  agent added no policy, no condition and no scope beyond it.

## 4. Follow-on work this packet does not perform

| Item | State after this packet |
|---|---|
| ADR-0015 acceptance | Not performed; remains `PROPOSED` |
| Platform Contract definition | Not authorized |
| Kubernetes / virtualization selection | Not performed; `UNDECIDED` |
| Canonical `T0`/`T1`/`T2` tier contract | Not performed; open |
| AWS artifact cleanup or deletion | Not authorized; artifacts retained |
| Production rollout | Not authorized; authority `CLOSED` |
