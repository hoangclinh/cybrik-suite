# G-U2B PostgreSQL runtime topology diagnosis R1

Status: `PROPOSED — READ-ONLY DIAGNOSIS — NO RUNTIME AUTHORITY`.

Recorded: `2026-08-04T16:05:00+07:00`.

Release dates remain unchanged. G-U2B RED, browser UAT and demo remain `HOLD`. Production remains
Founder only.

## 1. Scope and evidence floor

This packet diagnoses why bounded attempt `20260804T082945Z-22343` stopped and proposes a
separate topology-rehearsal gate before any new PostgreSQL RED admission. It does not authorize a
container, listener, connection, migration, test, retry, commit, merge, release or production
action.

Preserved authoritative evidence:

- result packet: `G-U2B-POSTGRES-RED-RUNTIME-RESULT-R1.md`, SHA-256
  `24d65a67b3e916988114542342bd5411ef87081b28d972d41b25e6d0a94388fe`;
- external evidence root:
  `/Users/hoanglinh/.local/state/cybrik-g-u2b-db-red-5e13e50f/20260804T082945Z-22343`,
  canonical manifest SHA-256
  `7a194d0a834798a5607b48bb140e67de520ebf91787e085c02065b40c52dcbbb`.

Post-attempt operator observations are recorded separately in section 3. They were not captured
inside the attempt evidence root or covered by its canonical manifest. They support diagnosis only
and cannot independently satisfy a future topology gate.

Primary references, retrieved `2026-08-04` (live URLs; not archived evidence):

- [Docker Desktop networking](https://docs.docker.com/desktop/features/networking/);
- [Docker port publishing](https://docs.docker.com/engine/network/port-publishing/);
- [Docker internal-network semantics](https://docs.docker.com/reference/cli/docker/network/create/#network-internal-mode---internal);
- [Docker Engine 27 networking release notes](https://docs.docker.com/engine/release-notes/27/#networking),
  used only as historical syntax context and not as evidence for the observed Engine `29.6.2`; and
- [Docker Desktop issue 5588](https://github.com/docker/for-mac/issues/5588), retained only as
  historical implementation context for empty versus explicit-zero host ports.

## 2. Preserved facts and qualified phase floor

1. The container was created and started from the already-present `postgres:16-alpine` image.
2. The runner reached the post-health listener-posture boundary before it stopped.
3. The next runner command, `docker port <container> 5432/tcp`, returned:

   ```text
   no public port '5432/tcp' published for cybrik-g-u2b-red-20260804T082945Z22343
   ```

4. The runner immediately tore down the exact container, internal network, volume and temporary
   credential material; absence was verified.
5. Role bootstrap, committed migrations, application-role preflight, collection and pytest were
   not executed.

The result packet explicitly limits the audit strength of item 5: the preserved transcript set has
no role, migration or pytest transcript, and the negative phase assertions include a post-attempt
operator attestation. This proposal does not strengthen that evidence retroactively.

## 3. Post-attempt operator observations

After the attempt had stopped and its resources had been torn down, a read-only daemon-event query
for container `cybrik-g-u2b-red-20260804T082945Z22343` used the deliberately padded query window
`2026-08-04T08:29:40Z..2026-08-04T08:30:05Z`, starting five seconds before the result packet's
recorded attempt start so a create event would not be missed. Returned event timestamps were not
preserved, so the window does not establish that the container existed before the attempt. The port
attribute was observed as:

```text
desktop.docker.io/ports/5432/tcp=127.0.0.1:
```

The same post-attempt session observed Docker Desktop `4.84.0` build `234817`, Docker
client/server `29.6.2`, API `1.55`, context `desktop-linux`, on Apple Silicon.

A later read-only design check observed that host `pg_isready` was absent, `/usr/bin/nc` was
present with SHA-256
`427423db6d5d5e9f720c5e110a2c9b3cba39ea089dafed4ab936d04dd218bdac`, and the local macOS
ephemeral range was `49152..65535`. These are proposal-time observations, not attempt evidence.

These observations were not attempt-preserved or digest-pinned. They may age or become
unavailable and therefore support only the bounded hypothesis in section 5. Any future rehearsal
must capture and digest-pin its own event records, platform identity and inspect projections.

## 4. Documented Docker behavior and historical context

1. Docker's current documentation supports explicit loopback publication such as
   `127.0.0.1:8080:80`. Engine release notes also describe address-specific empty-host-port syntax,
   but Docker Desktop performs host-side port allocation/proxying outside the Engine VM.
2. Historical Docker Desktop maintainer analysis records that `0:<container-port>` and omitted
   host-port forms have followed different proxy paths and explicitly warns that the observed
   `0:` workaround was implementation-dependent. It is not accepted here as a stable control.

These references document supported interfaces and historical implementation behavior; they are
not evidence of what occurred during the bound attempt.

## 5. Bounded inference

The failure was not PostgreSQL startup, image absence, source drift or application-test behavior.
The preserved manifest does not contain the runner bytes or exact Docker publish argument; the
pinned runner SHA-256 cannot recover those bytes. The form `127.0.0.1::5432` is therefore
reconstructed from the non-preserved event attribute rather than confirmed as an attempt fact.
Subject to that limitation, the strongest current inference is that Docker Desktop did not
materialize an ephemeral host port for an address-specific omitted-host-port request on this exact
platform.

This evidence does **not** prove that `--internal` prevents a fixed loopback mapping. It also does
not prove that replacing the empty host port with `0` is reliable. Those are separate hypotheses
and must not be converted into a RED retry without a topology-only rehearsal.

## 6. Selected proposal

Use a new, separately authorized topology-rehearsal series before preparing a new RED series.
The rehearsal uses one exact, predeclared high host port rather than Docker Desktop's ephemeral
allocation path.

Proposed mapping for review:

```text
REHEARSAL_PORT = 15433
mapping = 127.0.0.1:<REHEARSAL_PORT>:5432/tcp
```

`<REHEARSAL_PORT>` means the single binding above; it is not a runtime variable. Port `15433` is
below the observed local ephemeral range. The final port and its range observation must be frozen
in the external authorization. They may change during proposal review, but not after signing.

Why this option is selected:

- explicit loopback publication is a documented stable Docker interface;
- an atomic Docker bind fails closed if the port is unavailable;
- the exact listener can be inspected at Engine, Desktop event and host-process layers;
- it avoids undocumented reliance on `127.0.0.1:0:5432`;
- it preserves the single-container and internal-network design; and
- the rehearsal can prove or falsify the remaining `--internal` compatibility question without
  consuming another product RED attempt.

Rejected for this proposal:

- retrying the inferred `127.0.0.1::5432` form;
- relying on `127.0.0.1:0:5432` as a Desktop-specific workaround;
- host networking, which discards port mapping and weakens isolation;
- a non-internal bridge solely to make publication convenient;
- direct container-IP access from macOS, which Docker Desktop does not expose like native Linux;
- a second proxy/sidecar container; and
- moving the test into the PostgreSQL container.

## 7. Proposed topology-only rehearsal

The future rehearsal authorization must permit exactly one logical attempt and only these effects:

1. Re-observe exact Suite/SOC control identities and require clean worktrees.
2. Require the same already-present `postgres:16-alpine` image; no pull or install.
3. Re-observe the local ephemeral range and prove no current listener or Docker publication uses
   `127.0.0.1:<REHEARSAL_PORT>`.

Items 1–3 are the complete pre-consumption phase. Any failure closes the record as
`PRECHECK_ABORT` without Docker mutation or topology-attempt credit; do not retry under that
record. Only after all three pass may item 4 begin.

4. Create one new Docker `--internal` network, one disposable volume and one PostgreSQL container
   with exact mapping `127.0.0.1:<REHEARSAL_PORT>:5432/tcp` and `--pull=never`. The logical
   topology attempt becomes consumed immediately before the first Docker create command.
5. Require Docker health `healthy`.
6. Before teardown or terminal classification, prove all of the following agree:
   - daemon event attribute is exactly `127.0.0.1:<REHEARSAL_PORT>`;
   - `HostConfig.PortBindings` contains only `HostIp=127.0.0.1`,
     `HostPort=<REHEARSAL_PORT>`;
   - `NetworkSettings.Ports` contains the same single mapping;
   - `docker port` returns exactly `127.0.0.1:<REHEARSAL_PORT>`;
   - the host listener is loopback-only, never `0.0.0.0` or `::`; and
   - the exact bounded argument vector
     `/usr/bin/nc -z -w 5 127.0.0.1 <REHEARSAL_PORT>` reaches only that listener, using the exact
     binary path and SHA-256 frozen in the authorization. The literal IPv4 address forbids DNS and
     IPv6 fallback; `-z` forbids application data; `-w 5` bounds the connect. No host dependency
     install is permitted.
7. Prove the container is attached only to the named internal network and that the network reports
   `Internal=true`. The runner must contain no command naming a non-loopback address; this is a
   structural isolation control, not proof about unrelated host/background traffic.
8. Do not create application roles, run migrations, query product tables, collect pytest or run a
   test.
9. Teardown the exact container, network, volume and temporary credential material, then prove
   listener and resource absence.

Runtime limit: one 180-second cycle, no extension. Any mismatch closes the record under exactly one
class in section 8; it does not authorize a same-record retry.

## 8. Rehearsal acceptance criteria

`TOPOLOGY_PASS` requires successful evidence for every item 1–9 in section 7 and zero residual
resource. Evidence must include
the exact Docker Desktop/Engine versions, image ID, event records, both inspect projections,
host-listener observation, bounded reachability result, timestamps and teardown absence proof.

The result must use exactly one terminal class:

- `PRECHECK_ABORT`: any identity, clean-worktree, image, range or port-occupancy check in items 1–3
  failed; no Docker mutation and no topology-attempt credit;
- `TOPOLOGY_PASS`: publication, internal-network ingress and teardown all passed;
- `FAIL_PUBLICATION`: the Docker/event/inspect/host-listener projections did not all establish the
  exact fixed loopback publication;
- `FAIL_INTERNAL_INGRESS`: publication projections agreed, but the bounded host TCP probe could not
  reach the healthy container through the internal network; or
- `STOP_CONTROL`: an image, scope, identity, timeout, teardown or other control invariant failed.

Every class closes the authorization record and permits no same-record retry. For a consumed
attempt, teardown evidence is mandatory even when the primary class is a failure.

Classification precedence is exact. Before consumption, any item 1–3 failure is
`PRECHECK_ABORT`. After consumption, `STOP_CONTROL` overrides every diagnostic class when a scope,
identity, timeout, teardown or other control invariant fails. Otherwise publication-projection
failure is `FAIL_PUBLICATION`, agreed publication plus failed ingress is `FAIL_INTERNAL_INGRESS`,
and only a fully satisfied record is `TOPOLOGY_PASS`.

The following map directly to `FAIL_PUBLICATION`:

- publication race after the pre-consumption check;
- absent/multiple/wildcard/IPv6 listener;
- disagreement between events, inspect, `docker port` and the host listener.

The following map to `STOP_CONTROL`:

- non-internal or multiple network attachments;
- image pull/install prompt;
- any role, migration, product query, pytest or unrelated service effect;
- timeout; or
- incomplete teardown.

## 9. Lineage and validator changes required before rehearsal authorization

The topology rehearsal is a non-product preflight record, not a runtime-admission candidate and
not a UAT attempt. Before authorizing it, the repository must define and test these controls:

1. Create a dedicated schema and validator that discover only
   `docs/uat/topology-rehearsals/*/topology-rehearsal.json`, never
   `docs/uat/candidates/*/runtime-admission.json`. The exact R1 directory is
   `docs/uat/topology-rehearsals/postgres-loopback-internal-v1-r1/` and contains one grant, one
   result, one committed `evidence-manifest.json`, one independent review and the machine record.
2. Give the preflight the exact identity
   `cybrik.suite.runtime-topology/postgres-loopback-internal-v1` and record ID
   `postgres-loopback-internal-v1-r1`. Its grant/result digests are not runtime execution evidence.
   A dedicated policy and a validator-embedded exact constant must both allow only that one record;
   exact equality is required. A second record, alias, ordinal or identity reuse must fail closed.
3. The committed evidence manifest records external evidence paths and digests but cannot make
   external bytes CI-verifiable. The independent local review must re-read those bytes before the
   result is committed; the machine record and downstream lineage pin the committed manifest path
   and SHA-256 without claiming CI revalidation of the external root.
4. Add a typed `topology_prerequisite` to future runtime-admission lineage. It must contain the
   preflight identity, committed result path/SHA-256, evidence-manifest SHA-256 and constant
   `evidence_use=non_authorizing_preflight`.
5. Exclude that typed prerequisite from `evidence.artifacts[]` and
   `current_attempt.evidence_sha256`; this preserves cross-series execution-evidence uniqueness.
6. Generalize the immutable lineage policy so the consumed
   `browser-integrated-uat-bridge-r1` HOLD/STOP record at
   `docs/uat/candidates/browser-integrated-uat-bridge-r1/runtime-admission.json`, SHA-256
   `b463b6032a69b68958cd6a470a5a1ac8976ae6778bdb26192a13c5009128e578`, can be carried through a
   typed `sealed_predecessor` reference without pretending that it is a failed `NO-GO` legacy
   candidate.
7. Require each allowed objective to enumerate exact allowed `series_id` values in the lineage
   policy and in a validator-embedded exact constant, with equality enforced. Add a successor
   series only in the separately reviewed post-`TOPOLOGY_PASS` admission change. Any unlisted new
   series must fail validation, including another series under `golden-uat-v1`.
8. Add negative tests for missing/drifted/wrong-use topology prerequisites, reuse as execution
   evidence, an external-manifest overclaim, a second/aliased preflight record, unsealed
   predecessors, policy/constant drift, unlisted series, reopening the consumed series and multiple
   successor series.

Until these controls are implemented and independently reviewed, the topology rehearsal remains
unauthorized even if this diagnosis packet is accepted.

## 10. Gate sequence after a topology pass

1. Independently review the topology evidence with P0/P1/P2 required at zero.
2. Prepare a new RED runner that replaces the empty-host-port request with the exact rehearsed
   fixed mapping and binds its own SHA-256. Carry the committed `TOPOLOGY_PASS` result only through
   the typed non-authorizing `topology_prerequisite` defined in section 9.
3. Prepare a new runtime-admission series. The consumed HOLD/STOP record is carried only through
   the digest-pinned `sealed_predecessor`; it supplies no execution or RED credit.
4. Run validator tests proving the old series cannot regain authority, arbitrary new series are
   rejected, and only the one explicitly allowlisted successor series can become the singleton
   effective authorization.
5. Obtain a new independent review and external authorization before any PostgreSQL RED attempt.

Even after `TOPOLOGY_PASS`, G-U2B RED, GREEN implementation, integrated UAT, demo and release all
remain `HOLD` until their separate gates pass.
