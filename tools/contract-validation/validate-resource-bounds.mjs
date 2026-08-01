// Gate W2-H resource-bounds contract validator.
//
// Deterministic Suite-side static conformance only. This file is not product
// runtime code. Under the W2-H/R5 amendment the packet is accepted for
// implementation but not implemented, so a green result proves no UAT/runtime
// and grants no release or production authority.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, '../..');
const CONTRACTS_ROOT = 'contracts/';
// W2-H/R5: the accepted lifecycle carries its own NOT IMPLEMENTED ceiling, so
// acceptance can never be read as implementation evidence.
const ACCEPTED_LIFECYCLE = 'ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED';

export const RESOURCE_KEYS = [
  'cpu_millis',
  'memory_byte_millis',
  'model_tokens',
  'tool_calls',
  'retrieved_bytes',
  'egress_bytes',
];

export const REPLAY_ERROR_CODES = [
  'RES_ACTIVE_CHILDREN',
  'RES_ALREADY_RELEASED',
  'RES_IDEMPOTENCY_CONFLICT',
  'RES_INSUFFICIENT_REMAINDER',
  'RES_NO_MINT_ON_SPAWN',
  'RES_ORG_SCOPE_MISMATCH',
  'RES_PARENT_CLOSED',
  'RES_PARENT_NOT_FOUND',
  'RES_RELEASE_ACCOUNTING_MISMATCH',
  'RES_RESULT_MISMATCH',
  'RES_ROOT_CLOSED',
  'RES_SEQUENCE_VIOLATION',
  'RES_TENANT_MISMATCH',
  'RES_VERSION_CONFLICT',
  'RES_VIRTUAL_TIME_ROLLBACK',
];

export const FORBIDDEN_AUTHORITY_PROPERTY_KEYS = [
  'access_token',
  'api_key',
  'approval',
  'approval_id',
  'assertion',
  'authority_token',
  'authorization',
  'bearer',
  'bearer_token',
  'capability',
  'credential',
  'delegation',
  'permission',
  'refresh_token',
  'role',
  'secret',
  'signature',
  'token',
];

const SCHEMA_PATHS = [
  'contracts/json-schema/cybrik.res-common-defs.v1.schema.json',
  'contracts/json-schema/cybrik.res-bounds-grant.v1.schema.json',
  'contracts/json-schema/cybrik.res-reservation-request.v1.schema.json',
  'contracts/json-schema/cybrik.res-reservation-result.v1.schema.json',
  'contracts/json-schema/cybrik.res-release.v1.schema.json',
  'contracts/json-schema/cybrik.res-root-closure.v1.schema.json',
  'contracts/json-schema/cybrik.res-bounds-error.v1.schema.json',
];

const POSITIVE_PATHS = [
  'contracts/examples/resource-bounds/positive/bounds-grant.root.json',
  'contracts/examples/resource-bounds/positive/reservation-request.child.json',
  'contracts/examples/resource-bounds/positive/reservation-result.admitted.json',
  'contracts/examples/resource-bounds/positive/reservation-result.denied.json',
  'contracts/examples/resource-bounds/positive/release.completed.json',
  'contracts/examples/resource-bounds/positive/root-closure.completed.json',
  'contracts/examples/resource-bounds/positive/bounds-error.standalone.json',
  'contracts/examples/resource-bounds/positive/replay.conserved-tree.json',
  'contracts/examples/resource-bounds/positive/replay.denied-admission.json',
  'contracts/examples/resource-bounds/positive/replay.denied-then-admitted.json',
];

const NEGATIVE_SCHEMA_PATHS = [
  'contracts/examples/resource-bounds/negative-schema/bounds-grant.authority-token.json',
  'contracts/examples/resource-bounds/negative-schema/bounds-grant.empty-vector.json',
  'contracts/examples/resource-bounds/negative-schema/reservation-request.zero-vector.json',
  'contracts/examples/resource-bounds/negative-schema/reservation-request.short-idempotency-key.json',
  'contracts/examples/resource-bounds/negative-schema/reservation-result.admitted-with-error.json',
  'contracts/examples/resource-bounds/negative-schema/reservation-result.denied-with-reservation.json',
  'contracts/examples/resource-bounds/negative-schema/release.missing-accounting.json',
  'contracts/examples/resource-bounds/negative-schema/release.missing-root.json',
  'contracts/examples/resource-bounds/negative-schema/root-closure.partial-closure.json',
  'contracts/examples/resource-bounds/negative-schema/bounds-error.retriable-mismatch.json',
];

const NEGATIVE_SEMANTIC_PATHS = [
  'contracts/examples/resource-bounds/negative-semantic/replay.parent-overdraw.json',
  'contracts/examples/resource-bounds/negative-semantic/replay.no-mint-spawn.json',
  'contracts/examples/resource-bounds/negative-semantic/replay.tenant-mismatch.json',
  'contracts/examples/resource-bounds/negative-semantic/replay.org-scope-mismatch.json',
  'contracts/examples/resource-bounds/negative-semantic/replay.idempotency-conflict.json',
  'contracts/examples/resource-bounds/negative-semantic/replay.double-release.json',
  'contracts/examples/resource-bounds/negative-semantic/replay.over-return.json',
  'contracts/examples/resource-bounds/negative-semantic/replay.parent-closed.json',
  'contracts/examples/resource-bounds/negative-semantic/replay.root-cancel-remint.json',
  'contracts/examples/resource-bounds/negative-semantic/replay.root-binding-mismatch.json',
  'contracts/examples/resource-bounds/negative-semantic/replay.root-closure-accounting-mismatch.json',
  'contracts/examples/resource-bounds/negative-semantic/replay.sequence-gap.json',
  'contracts/examples/resource-bounds/negative-semantic/replay.closure-settlement-split-mismatch.json',
  'contracts/examples/resource-bounds/negative-semantic/replay.record-sequence-mismatch.json',
  'contracts/examples/resource-bounds/negative-semantic/replay.denial-unjustified.json',
  'contracts/examples/resource-bounds/negative-semantic/replay.denial-idempotency-conflict.json',
];

export const EXAMPLES_MANIFEST_PATH =
  'contracts/examples/resource-bounds/examples-manifest.json';
export const COMPATIBILITY_MANIFEST_PATH =
  'contracts/compatibility/cybrik-suite-resource-bounds-packet.v1.manifest.json';

export const expectedPacketPaths = [
  ...SCHEMA_PATHS,
  EXAMPLES_MANIFEST_PATH,
  ...POSITIVE_PATHS,
  ...NEGATIVE_SCHEMA_PATHS,
  ...NEGATIVE_SEMANTIC_PATHS,
  COMPATIBILITY_MANIFEST_PATH,
].sort();

const ACCEPTED_DEPENDENCY_PINS = {
  'contracts/json-schema/cybrik.common-defs.v1.schema.json':
    'cecc415ca472eb841985517504fdc721ab303f977f0a2fa1998c37c3514116c0',
  'contracts/json-schema/cybrik.investigation-create-request.v1.schema.json':
    '4cfe118bb2b2e7c8e51a70ce86e8f9cbc06cbe1621105efcd7400fd2bfbe46fd',
  'contracts/compatibility/cybrik-suite-investigation-lifecycle-proposal.v1.manifest.json':
    'e9d7f8b7f619821a97f41de3fcb265d419ed900934ec21450d49f04157b74ce0',
  'docs/adr/ADR-0003-durable-agent-orchestration.md':
    'be7b8062c9af9135dce446c007bfbbc83c61cb17cf70f135af1bd2bc8c3b8520',
};

const sha256 = (value) =>
  createHash('sha256').update(value).digest('hex');
const fileSha256 = (path) => sha256(readFileSync(path));
const stableClone = (value) => JSON.parse(JSON.stringify(value));
const vectorsEqual = (left, right) =>
  RESOURCE_KEYS.every((key) => (left?.[key] ?? 0) === (right?.[key] ?? 0));

export const zeroVector = () =>
  Object.fromEntries(RESOURCE_KEYS.map((key) => [key, 0]));

export const vectorAdd = (left, right) =>
  Object.fromEntries(
    RESOURCE_KEYS.map((key) => [
      key,
      (left?.[key] ?? 0) + (right?.[key] ?? 0),
    ]),
  );

export const vectorLessThanOrEqual = (left, right) =>
  RESOURCE_KEYS.every((key) => (left?.[key] ?? 0) <= (right?.[key] ?? 0));

export const vectorSubtract = (left, right) => {
  if (!vectorLessThanOrEqual(right, left)) {
    throw new Error('resource overdraw: insufficient parent remainder');
  }
  return Object.fromEntries(
    RESOURCE_KEYS.map((key) => [
      key,
      (left?.[key] ?? 0) - (right?.[key] ?? 0),
    ]),
  );
};

// C4: the canonical idempotent request identity. Exactly three fields are
// excluded — the two ledger-position fields, which C2 pins to the envelope, and
// the optimistic-concurrency assertion, which is re-read at issue time. Every
// other field is bound, so a key can never be reused for a materially different
// draw. Exclusion from the identity is not exemption from validation: the
// positional fields are still bound by C2 and expected_version is still checked
// against the parent's current version.
const canonicalRequestIdentity = (request) => {
  const identity = stableClone(request);
  delete identity.sequence;
  delete identity.virtual_time_ms;
  if (identity.parent && typeof identity.parent === 'object') {
    delete identity.parent.expected_version;
  }
  return identity;
};

// C4: the admitted result projection. Exactly the two position fields are
// excluded, because the re-issue occupies a different ledger position; C2 binds
// each of them to its own envelope instead, so neither is left unchecked.
const admittedResultProjection = (result) => {
  const projection = stableClone(result);
  delete projection.sequence;
  delete projection.virtual_time_ms;
  return projection;
};

// C2: the nested public records one ledger event carries. A reserve event is
// one atomic admission result group, so its request and its result are both
// nested records of the same position.
const NESTED_RECORD_SELECTORS = {
  grant: [(payload) => payload],
  reserve: [(payload) => payload?.request, (payload) => payload?.result],
  release: [(payload) => payload],
  'root-closure': [(payload) => payload],
};

const replayFailure = ({ code, trace, root }) => ({
  accepted: false,
  errors: [code],
  finalRootRemaining: root ? stableClone(root.remaining) : undefined,
  trace,
  traceDigest: sha256(Buffer.from(JSON.stringify(trace), 'utf8')),
});

export const declaredDependencyPinsMatch = (manifest) => {
  const declared = Object.fromEntries(
    (manifest?.dependencies_reused_unmodified ?? []).map((entry) => [
      entry.file.startsWith('../')
        ? entry.file.slice(3)
        : `${CONTRACTS_ROOT}${entry.file}`,
      entry.sha256,
    ]),
  );
  return isDeepStrictEqual(declared, ACCEPTED_DEPENDENCY_PINS);
};

/**
 * Deterministic replay model for L2 fixture proof only.
 *
 * This is deliberately not a product runtime. It has no wall clock, network,
 * concurrency, persistence, credentials, or external state.
 */
export function replayResourceCase(fixture) {
  const trace = [];
  const reservations = new Map();
  const idempotency = new Map();
  const context = fixture?.credential_context ?? {};
  let root;
  let expectedSequence = 1;
  let previousVirtualTime = -1;
  // C1: the ledger-derived half of a closure settlement. Every validated
  // release adds its declared consumed credit here, so a terminal closure is
  // reconciled against the ledger rather than against an arithmetic identity.
  let accumulatedConsumed = zeroVector();

  const fail = (code) => replayFailure({ code, trace, root });
  // B2: a record's root binding is an identity statement about which tree it
  // belongs to. A record naming a foreign tree is refused exactly like a
  // record naming a parent that does not exist.
  const isBoundToRoot = (rootReference) =>
    Boolean(root)
    && Boolean(rootReference)
    && typeof rootReference === 'object'
    && rootReference.kind === 'grant'
    && rootReference.id === root.grantId;
  const getParent = (parentRef) => {
    if (!root || !parentRef) return undefined;
    if (parentRef.kind === 'grant' && parentRef.id === root.grantId) return root;
    if (parentRef.kind === 'reservation') return reservations.get(parentRef.id);
    return undefined;
  };

  for (const event of fixture?.events ?? []) {
    if (!event || typeof event !== 'object') {
      return fail('RES_RESULT_MISMATCH');
    }
    if (event.sequence !== expectedSequence) return fail('RES_SEQUENCE_VIOLATION');
    if (
      !Number.isInteger(event.virtual_time_ms)
      || event.virtual_time_ms < previousVirtualTime
    ) {
      return fail('RES_VIRTUAL_TIME_ROLLBACK');
    }
    expectedSequence += 1;
    previousVirtualTime = event.virtual_time_ms;

    // C2: envelope and nested-record ordering must agree. The dense envelope
    // check above runs first, so a ledger that both skips a position and
    // misreports it inside a payload still fails on the dense rule. A nested
    // record stamped earlier than its envelope asserts that virtual time ran
    // backwards inside one ledger position and takes the rollback code; a
    // nested record stamped later is a record field failing to equal the
    // replayed state that produced it, which is a result mismatch.
    const selectors = NESTED_RECORD_SELECTORS[event.kind];
    if (!selectors) return fail('RES_RESULT_MISMATCH');
    const nestedRecords = selectors.map((select) => select(event.payload));
    if (nestedRecords.some((record) => !record || typeof record !== 'object')) {
      return fail('RES_RESULT_MISMATCH');
    }
    for (const record of nestedRecords) {
      if (record.sequence !== event.sequence) {
        return fail('RES_SEQUENCE_VIOLATION');
      }
      if (
        !Number.isInteger(record.virtual_time_ms)
        || record.virtual_time_ms < event.virtual_time_ms
      ) {
        return fail('RES_VIRTUAL_TIME_ROLLBACK');
      }
      if (record.virtual_time_ms > event.virtual_time_ms) {
        return fail('RES_RESULT_MISMATCH');
      }
    }

    if (event.kind === 'grant') {
      const grant = event.payload;
      if (!grant || typeof grant !== 'object') {
        return fail('RES_RESULT_MISMATCH');
      }
      if (root) return fail('RES_RESULT_MISMATCH');
      if (grant.tenant_id !== context.tenant_id) return fail('RES_TENANT_MISMATCH');
      if (!isDeepStrictEqual(grant.org_scope_ref, context.org_scope_ref)) {
        return fail('RES_ORG_SCOPE_MISMATCH');
      }
      root = {
        kind: 'grant',
        grantId: grant.grant_id,
        tenantId: grant.tenant_id,
        orgScopeRef: grant.org_scope_ref,
        // The original bounds are retained because terminal root closure
        // reconciles final_consumed + final_unused against them.
        bounds: stableClone(grant.bounds),
        remaining: stableClone(grant.bounds),
        version: grant.state_version,
        closed: false,
      };
      trace.push({
        kind: 'grant',
        sequence: event.sequence,
        virtualTimeMs: event.virtual_time_ms,
        remaining: stableClone(root.remaining),
        rootClosed: false,
      });
      continue;
    }

    if (!root) return fail('RES_PARENT_NOT_FOUND');
    if (root.closed) return fail('RES_ROOT_CLOSED');

    if (event.kind === 'reserve') {
      const { request, result } = event.payload ?? {};
      if (
        !request
        || typeof request !== 'object'
        || !result
        || typeof result !== 'object'
      ) {
        return fail('RES_RESULT_MISMATCH');
      }
      if (request.tenant_id !== context.tenant_id) {
        return fail('RES_TENANT_MISMATCH');
      }
      if (!isDeepStrictEqual(request.org_scope_ref, context.org_scope_ref)) {
        return fail('RES_ORG_SCOPE_MISMATCH');
      }
      if (!isBoundToRoot(request.root) || !isBoundToRoot(result.root)) {
        return fail('RES_PARENT_NOT_FOUND');
      }

      // C4: mutation is refused. An event whose key is already bound but whose
      // canonical identity differs in any bound field conflicts, whether the
      // prior binding was denied or admitted.
      const identity = canonicalRequestIdentity(request);
      const prior = idempotency.get(request.idempotency_key);
      if (prior && !isDeepStrictEqual(prior.identity, identity)) {
        return fail('RES_IDEMPOTENCY_CONFLICT');
      }

      const parent = getParent(request.parent);
      if (!parent) return fail('RES_PARENT_NOT_FOUND');
      if (parent.closed) return fail('RES_PARENT_CLOSED');
      // C4: the version guard now covers identity-matching re-issues too. R2
      // short-circuited an already-bound key before this point; removing that
      // bypass is coverage, not reordering — the check keeps the place R2 gave
      // it on a first presentation. Excluding expected_version from the
      // identity recognizes the same request across a version change; it is not
      // permission to re-present a stale assertion.
      if (request.parent.expected_version !== parent.version) {
        return fail('RES_VERSION_CONFLICT');
      }

      // C4: admitted is final. An identity-matching event after an admitted
      // binding changes no state and re-draws nothing, and its result must
      // reproduce the recorded original under the admitted result projection.
      // The comparison is against the recorded original rather than a
      // recomputation from current state — that is what makes it an idempotent
      // replay instead of a second admission.
      if (prior?.status === 'admitted') {
        if (!isDeepStrictEqual(admittedResultProjection(result), prior.projection)) {
          return fail('RES_RESULT_MISMATCH');
        }
        trace.push({
          kind: 'reserve',
          sequence: event.sequence,
          virtualTimeMs: event.virtual_time_ms,
          admitted: true,
          idempotentReplay: true,
        });
        continue;
      }

      // C3: a request is inadmissible exactly when it exceeds the parent's
      // remainder in at least one dimension.
      const admissible = vectorLessThanOrEqual(request.requested, parent.remaining);

      // B4: a denied admission is a real, representable outcome. It carries
      // exactly one RES_* error and no reservation, moves neither the parent's
      // version nor its remainder, is recorded in the trace, and the tree
      // continues from the state the denial left alone.
      //
      // C3: the denial must additionally be justified by the replayed state. A
      // refusal the state does not justify, and a refusal under any code other
      // than the one the state implies, are both result mismatches.
      // RES_INSUFFICIENT_REMAINDER is the only denial code derivable at this
      // point by construction; a record presented against a missing parent, a
      // closed parent, a closed root, a foreign root, or a stale expected
      // version does not describe an admission outcome and was already refused
      // above under the code each of those checks carries.
      //
      // C4: a repeat denial must still be true — when a denied binding is
      // re-presented, this same derivation runs against the current state, so a
      // stale denial the peer state has since cleared is a result mismatch.
      if (result.status === 'denied') {
        const denialError = result.error;
        if (
          admissible
          || result.reservation !== undefined
          || !denialError
          || typeof denialError !== 'object'
          || denialError.code !== 'RES_INSUFFICIENT_REMAINDER'
          || result.request_id !== request.request_id
          || result.parent_version_before !== parent.version
          || result.parent_version_after !== parent.version
          || !vectorsEqual(result.parent_remaining_after, parent.remaining)
        ) {
          return fail('RES_RESULT_MISMATCH');
        }
        // C4: the key binds on denial as well as on admission, so a later
        // re-use of it cannot carry different content.
        idempotency.set(request.idempotency_key, { identity, status: 'denied' });
        trace.push({
          kind: 'reserve',
          sequence: event.sequence,
          virtualTimeMs: event.virtual_time_ms,
          admitted: false,
          requestId: request.request_id,
          deniedCode: denialError.code,
          parentRemaining: stableClone(parent.remaining),
        });
        continue;
      }

      if (!admissible) {
        return fail('RES_INSUFFICIENT_REMAINDER');
      }
      if (result?.status !== 'admitted' || !result.reservation) {
        return fail('RES_RESULT_MISMATCH');
      }
      if (
        !vectorsEqual(result.reservation.reserved, request.requested)
        || !vectorsEqual(result.reservation.remaining, request.requested)
      ) {
        return fail('RES_NO_MINT_ON_SPAWN');
      }

      const remainingAfter = vectorSubtract(parent.remaining, request.requested);
      if (
        result.request_id !== request.request_id
        || result.parent_version_before !== parent.version
        || result.parent_version_after !== parent.version + 1
        || !vectorsEqual(result.parent_remaining_after, remainingAfter)
      ) {
        return fail('RES_RESULT_MISMATCH');
      }

      const parentRemainingBefore = stableClone(parent.remaining);
      parent.remaining = remainingAfter;
      parent.version += 1;
      reservations.set(result.reservation.reservation_id, {
        kind: 'reservation',
        reservationId: result.reservation.reservation_id,
        parentKind: request.parent.kind,
        parentId: request.parent.id,
        tenantId: request.tenant_id,
        orgScopeRef: request.org_scope_ref,
        remaining: stableClone(result.reservation.remaining),
        version: result.reservation.state_version,
        closed: false,
      });
      // C4: peer state may clear a denial. A cleared denial draws the parent
      // down exactly as a first admission would and replaces the binding.
      idempotency.set(request.idempotency_key, {
        identity,
        status: 'admitted',
        projection: admittedResultProjection(result),
      });
      trace.push({
        kind: 'reserve',
        sequence: event.sequence,
        virtualTimeMs: event.virtual_time_ms,
        admitted: true,
        reservationId: result.reservation.reservation_id,
        requested: stableClone(request.requested),
        parentRemainingBefore,
        parentRemainingAfter: stableClone(parent.remaining),
      });
      continue;
    }

    if (event.kind === 'release') {
      const release = event.payload;
      if (!release || typeof release !== 'object') {
        return fail('RES_RESULT_MISMATCH');
      }
      if (release.tenant_id !== context.tenant_id) {
        return fail('RES_TENANT_MISMATCH');
      }
      if (!isDeepStrictEqual(release.org_scope_ref, context.org_scope_ref)) {
        return fail('RES_ORG_SCOPE_MISMATCH');
      }
      if (!isBoundToRoot(release.root)) return fail('RES_PARENT_NOT_FOUND');
      const reservation = reservations.get(release.target?.id);
      if (!reservation) return fail('RES_PARENT_NOT_FOUND');
      if (reservation.closed) return fail('RES_ALREADY_RELEASED');
      if (release.target.expected_version !== reservation.version) {
        return fail('RES_VERSION_CONFLICT');
      }
      const hasOpenChild = [...reservations.values()].some(
        (candidate) =>
          !candidate.closed
          && candidate.parentKind === 'reservation'
          && candidate.parentId === reservation.reservationId,
      );
      if (hasOpenChild) return fail('RES_ACTIVE_CHILDREN');

      const accounted = vectorAdd(release.consumed, release.returned);
      if (!vectorsEqual(accounted, reservation.remaining)) {
        return fail('RES_RELEASE_ACCOUNTING_MISMATCH');
      }
      const parent = getParent({
        kind: reservation.parentKind,
        id: reservation.parentId,
      });
      if (!parent) return fail('RES_PARENT_NOT_FOUND');
      if (parent.closed) return fail('RES_PARENT_CLOSED');

      const parentRemainingBefore = stableClone(parent.remaining);
      const availableBefore = stableClone(reservation.remaining);
      parent.remaining = vectorAdd(parent.remaining, release.returned);
      parent.version += 1;
      reservation.remaining = zeroVector();
      reservation.version += 1;
      reservation.closed = true;
      // C1: this release is now validated, so its consumed credit joins the
      // running total a later closure settles against.
      accumulatedConsumed = vectorAdd(accumulatedConsumed, release.consumed);
      trace.push({
        kind: 'release',
        sequence: event.sequence,
        virtualTimeMs: event.virtual_time_ms,
        admitted: true,
        reservationId: reservation.reservationId,
        availableBefore,
        consumed: stableClone(release.consumed),
        returned: stableClone(release.returned),
        parentRemainingBefore,
        parentRemainingAfter: stableClone(parent.remaining),
      });
      continue;
    }

    // B1: one terminal root record covers completion and cancellation. Its
    // accounting is reconciled exactly against the closing grant's original
    // bounds; the unused remainder is extinguished, returned to nobody.
    if (event.kind === 'root-closure') {
      const closure = event.payload;
      if (!closure || typeof closure !== 'object') {
        return fail('RES_RESULT_MISMATCH');
      }
      if (closure.tenant_id !== context.tenant_id) {
        return fail('RES_TENANT_MISMATCH');
      }
      if (!isDeepStrictEqual(closure.org_scope_ref, context.org_scope_ref)) {
        return fail('RES_ORG_SCOPE_MISMATCH');
      }
      if (!isBoundToRoot(closure.root)) return fail('RES_PARENT_NOT_FOUND');
      if (closure.closes_descendants !== true) {
        return fail('RES_RESULT_MISMATCH');
      }
      if (
        closure.state_version_before !== root.version
        || closure.state_version_after !== root.version + 1
      ) {
        return fail('RES_VERSION_CONFLICT');
      }
      // C1: both halves of the settlement are derived from the ledger replay
      // has already validated, so a sum-correct but split-wrong closure is
      // refused. This is declared contract-credit accounting: final_consumed is
      // the sum of credits ledger records declared consumed and final_unused is
      // credit the ledger never spent — neither is sampled, metered, or
      // observed from any running system. The closure reason is not an input to
      // the arithmetic: credit still held by a reservation open at a cancelled
      // closure was never spent, so it belongs to final_unused and is
      // extinguished. The sum equality survives as a corollary of the two split
      // equalities and is kept explicit so the invariant stays legible.
      const openReservationRemainder = [...reservations.values()]
        .filter((reservation) => !reservation.closed)
        .reduce(
          (sum, reservation) => vectorAdd(sum, reservation.remaining),
          zeroVector(),
        );
      const derivedUnused = vectorAdd(root.remaining, openReservationRemainder);
      if (
        !vectorsEqual(closure.final_consumed, accumulatedConsumed)
        || !vectorsEqual(closure.final_unused, derivedUnused)
        || !vectorsEqual(
          vectorAdd(closure.final_consumed, closure.final_unused),
          root.bounds,
        )
      ) {
        return fail('RES_RELEASE_ACCOUNTING_MISMATCH');
      }

      const closedDescendants = [];
      for (const reservation of reservations.values()) {
        if (reservation.closed) continue;
        reservation.closed = true;
        reservation.remaining = zeroVector();
        reservation.version += 1;
        closedDescendants.push({
          reservationId: reservation.reservationId,
          remainingAfter: zeroVector(),
        });
      }
      root.closed = true;
      root.remaining = zeroVector();
      root.version += 1;
      trace.push({
        kind: 'root-closure',
        sequence: event.sequence,
        virtualTimeMs: event.virtual_time_ms,
        admitted: true,
        rootClosed: true,
        reason: closure.reason,
        finalConsumed: stableClone(closure.final_consumed),
        finalUnused: stableClone(closure.final_unused),
        closedDescendants,
      });
      continue;
    }

    return fail('RES_RESULT_MISMATCH');
  }

  const result = {
    accepted: true,
    errors: [],
    finalRootRemaining: root ? stableClone(root.remaining) : undefined,
    trace,
    traceDigest: sha256(Buffer.from(JSON.stringify(trace), 'utf8')),
  };
  return result;
}

const loadJson = (root, relativePath, errors) => {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath)) {
    errors.push(`${relativePath}: missing`);
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    errors.push(`${relativePath}: invalid JSON (${error.message})`);
    return undefined;
  }
};

const loadAjv = () => {
  const dependencyRoot =
    process.env.CYBRIK_CONTRACT_VALIDATION_DEPS_ROOT || HERE;
  const require = createRequire(join(dependencyRoot, 'package.json'));
  const Ajv2020Module = require('ajv/dist/2020.js');
  const addFormatsModule = require('ajv-formats');
  return {
    Ajv2020: Ajv2020Module.default ?? Ajv2020Module,
    addFormats: addFormatsModule.default ?? addFormatsModule,
  };
};

const fixturePathFromEntry = (entry) =>
  `contracts/examples/resource-bounds/${entry.file}`;

const normalizeManifestMemberPath = (file) =>
  file.startsWith(CONTRACTS_ROOT) ? file : `${CONTRACTS_ROOT}${file}`;

const collectPropertyKeys = (value, output = []) => {
  if (Array.isArray(value)) {
    for (const item of value) collectPropertyKeys(item, output);
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  if (value.properties && typeof value.properties === 'object') {
    output.push(...Object.keys(value.properties));
  }
  for (const item of Object.values(value)) collectPropertyKeys(item, output);
  return output;
};

const validateNestedReplayPayloads = ({
  fixture,
  validators,
  relativePath,
  errors,
}) => {
  const mapping = {
    grant: [['payload', 'cybrik.res-bounds-grant.v1.schema.json']],
    reserve: [
      ['payload.request', 'cybrik.res-reservation-request.v1.schema.json'],
      ['payload.result', 'cybrik.res-reservation-result.v1.schema.json'],
    ],
    release: [['payload', 'cybrik.res-release.v1.schema.json']],
    'root-closure': [['payload', 'cybrik.res-root-closure.v1.schema.json']],
  };
  for (const event of fixture.events ?? []) {
    for (const [selector, schemaName] of mapping[event.kind] ?? []) {
      const value =
        selector === 'payload'
          ? event.payload
          : selector === 'payload.request'
            ? event.payload?.request
            : event.payload?.result;
      const validator = validators.get(schemaName);
      if (!validator || !validator(value)) {
        errors.push(
          `${relativePath}: ${event.kind} ${selector} fails ${schemaName}`,
        );
      }
    }
  }
};

export function validateResourceBoundsProposal({ root = DEFAULT_ROOT } = {}) {
  const errors = [];
  const counts = {
    schemasCompiled: 0,
    positiveFixtures: 0,
    positiveAccepted: 0,
    negativeSchemaFixtures: 0,
    negativeSchemaRejected: 0,
    negativeSemanticFixtures: 0,
    negativeSemanticRejectedExactly: 0,
    exampleDigestsVerified: 0,
    packetMemberDigestsVerified: 0,
    packetMembers: expectedPacketPaths.length,
    acceptedDependenciesPinned: 0,
  };

  for (const relativePath of expectedPacketPaths) {
    if (!existsSync(join(root, relativePath))) {
      errors.push(`${relativePath}: expected packet path missing`);
    }
  }

  const schemas = new Map();
  for (const relativePath of SCHEMA_PATHS) {
    const schema = loadJson(root, relativePath, errors);
    if (schema) schemas.set(basename(relativePath), schema);
  }
  const acceptedCommon = loadJson(
    root,
    'contracts/json-schema/cybrik.common-defs.v1.schema.json',
    errors,
  );

  const validators = new Map();
  if (schemas.size === SCHEMA_PATHS.length && acceptedCommon) {
    try {
      const { Ajv2020, addFormats } = loadAjv();
      const ajv = new Ajv2020({
        allErrors: true,
        strict: true,
        strictRequired: false,
        validateFormats: true,
      });
      addFormats(ajv);
      for (const keyword of [
        'x-cybrik-contract-version',
        'x-cybrik-format-pins',
        'x-cybrik-is-bundle-tag',
        'x-cybrik-not-accepted',
        'x-cybrik-status',
      ]) {
        ajv.addKeyword({ keyword });
      }
      ajv.addSchema(acceptedCommon);
      for (const schema of schemas.values()) ajv.addSchema(schema);
      for (const [name, schema] of schemas) {
        validators.set(name, ajv.getSchema(schema.$id) ?? ajv.compile(schema));
        counts.schemasCompiled += 1;
      }
    } catch (error) {
      errors.push(`schema compilation failed: ${error.message}`);
    }
  }

  const examples = loadJson(root, EXAMPLES_MANIFEST_PATH, errors);
  const entries = examples?.fixtures;
  if (!Array.isArray(entries)) {
    errors.push(`${EXAMPLES_MANIFEST_PATH}: fixtures must be an array`);
  } else {
    const entryPaths = entries.map(fixturePathFromEntry);
    const expectedFixturePaths = [
      ...POSITIVE_PATHS,
      ...NEGATIVE_SCHEMA_PATHS,
      ...NEGATIVE_SEMANTIC_PATHS,
    ].sort();
    if (
      JSON.stringify([...entryPaths].sort())
      !== JSON.stringify(expectedFixturePaths)
    ) {
      errors.push(`${EXAMPLES_MANIFEST_PATH}: fixture inventory drift`);
    }
    if (new Set(entryPaths).size !== entryPaths.length) {
      errors.push(`${EXAMPLES_MANIFEST_PATH}: duplicate fixture entry`);
    }

    for (const entry of entries) {
      const relativePath = fixturePathFromEntry(entry);
      const fixture = loadJson(root, relativePath, errors);
      if (!fixture) continue;
      if (!/^[0-9a-f]{64}$/.test(entry.sha256 ?? '')) {
        errors.push(`${relativePath}: missing lowercase sha256 pin`);
      } else if (fileSha256(join(root, relativePath)) !== entry.sha256) {
        errors.push(`${relativePath}: fixture sha256 mismatch`);
      } else {
        counts.exampleDigestsVerified += 1;
      }

      if (entry.kind === 'positive') {
        counts.positiveFixtures += 1;
        if (entry.schema) {
          const validator = validators.get(entry.schema);
          if (!validator || !validator(fixture)) {
            errors.push(`${relativePath}: positive fixture failed ${entry.schema}`);
          } else {
            counts.positiveAccepted += 1;
          }
        } else {
          validateNestedReplayPayloads({
            fixture,
            validators,
            relativePath,
            errors,
          });
          const replay = replayResourceCase(fixture);
          if (
            replay.accepted !== true
            || replay.errors.length !== 0
            || fixture.expected?.accepted !== true
            || !vectorsEqual(
              replay.finalRootRemaining,
              fixture.expected?.final_root_remaining,
            )
          ) {
            errors.push(`${relativePath}: positive replay did not conserve`);
          } else {
            counts.positiveAccepted += 1;
          }
        }
      } else if (entry.kind === 'negative-schema') {
        counts.negativeSchemaFixtures += 1;
        const validator = validators.get(entry.schema);
        if (!validator) {
          errors.push(`${relativePath}: unknown schema ${entry.schema}`);
        } else if (validator(fixture)) {
          errors.push(`${relativePath}: negative-schema fixture unexpectedly valid`);
        } else {
          counts.negativeSchemaRejected += 1;
        }
      } else if (entry.kind === 'negative-semantic') {
        counts.negativeSemanticFixtures += 1;
        validateNestedReplayPayloads({
          fixture,
          validators,
          relativePath,
          errors,
        });
        const replay = replayResourceCase(fixture);
        if (
          fixture.expected?.accepted !== false
          || fixture.expected?.error_codes?.length !== 1
          || entry.expected_error !== fixture.expected.error_codes[0]
          || replay.accepted !== false
          || replay.errors.length !== 1
          || replay.errors[0] !== entry.expected_error
        ) {
          errors.push(
            `${relativePath}: semantic replay did not fail exactly ${entry.expected_error}`,
          );
        } else {
          counts.negativeSemanticRejectedExactly += 1;
        }
      } else {
        errors.push(`${relativePath}: unsupported fixture kind ${entry.kind}`);
      }
    }
  }

  const manifest = loadJson(root, COMPATIBILITY_MANIFEST_PATH, errors);
  const status = manifest?.['x-cybrik-status'];
  const notAccepted = manifest?.['x-cybrik-not-accepted'];
  const notImplemented = manifest?.['x-cybrik-not-implemented'];
  const packetVersion = manifest?.['x-cybrik-packet-version'];
  const gate =
    manifest?.gate?.id
    ?? manifest?.gate_id
    ?? manifest?.gate?.gate_id;
  const gateDisposition =
    manifest?.gate?.disposition
    ?? manifest?.gate_disposition;

  if (status !== ACCEPTED_LIFECYCLE) {
    errors.push(`manifest status must be ${ACCEPTED_LIFECYCLE}`);
  }
  if (notAccepted !== false) errors.push('manifest must say accepted');
  if (notImplemented !== true) errors.push('manifest must say not implemented');
  if (packetVersion !== '0.1.0') errors.push('packet version must be 0.1.0');
  if (manifest?.['x-cybrik-is-bundle-tag'] !== false) {
    errors.push('accepted contract must not be an immutable bundle tag');
  }
  if (gate !== 'W2-H') errors.push('manifest gate id must be W2-H');
  if (gateDisposition !== ACCEPTED_LIFECYCLE) {
    errors.push('manifest gate disposition is not the accepted lifecycle');
  }

  const propertyKeys = collectPropertyKeys([...schemas.values()]);
  for (const forbidden of FORBIDDEN_AUTHORITY_PROPERTY_KEYS) {
    if (propertyKeys.includes(forbidden)) {
      errors.push(`parallel authority property '${forbidden}' is forbidden`);
    }
  }

  if (manifest) {
    const members = manifest.members;
    if (!Array.isArray(members)) {
      errors.push('manifest members must be an array');
    } else {
      const normalized = members.map((entry) =>
        normalizeManifestMemberPath(entry.file),
      );
      if (
        JSON.stringify([...normalized].sort())
        !== JSON.stringify(expectedPacketPaths)
      ) {
        errors.push('manifest member inventory drift');
      }
      if (new Set(normalized).size !== normalized.length) {
        errors.push('manifest member inventory contains duplicates');
      }

      const integrity = manifest['x-cybrik-packet-integrity'];
      if (integrity?.member_count !== members.length) {
        errors.push('packet integrity member_count mismatch');
      }
      const memberDigests = integrity?.member_digests;
      if (!Array.isArray(memberDigests)) {
        errors.push('packet integrity member_digests must be an array');
      } else {
        const digestPaths = memberDigests.map((entry) =>
          normalizeManifestMemberPath(entry.file),
        );
        if (
          JSON.stringify([...digestPaths].sort())
          !== JSON.stringify(expectedPacketPaths)
        ) {
          errors.push('packet integrity member_digests inventory drift');
        }
        if (new Set(digestPaths).size !== digestPaths.length) {
          errors.push('packet integrity member_digests contains duplicates');
        }

        for (const memberDigest of memberDigests) {
          const normalizedPath = normalizeManifestMemberPath(memberDigest.file);
          if (!/^[0-9a-f]{64}$/.test(memberDigest.sha256 ?? '')) {
            errors.push(`${normalizedPath}: invalid member sha256`);
            continue;
          }
          let expectedDigest;
          if (normalizedPath === COMPATIBILITY_MANIFEST_PATH) {
            const withoutIntegrity = stableClone(manifest);
            delete withoutIntegrity['x-cybrik-packet-integrity'];
            expectedDigest = sha256(
              Buffer.from(JSON.stringify(withoutIntegrity), 'utf8'),
            );
          } else if (existsSync(join(root, normalizedPath))) {
            expectedDigest = fileSha256(join(root, normalizedPath));
          }
          if (expectedDigest !== memberDigest.sha256) {
            errors.push(`${normalizedPath}: member sha256 mismatch`);
          } else {
            counts.packetMemberDigestsVerified += 1;
          }
        }
      }

      const aggregateLines = [...(memberDigests ?? [])]
        .sort((left, right) =>
          left.file < right.file ? -1 : left.file > right.file ? 1 : 0)
        .map((entry) => `${entry.sha256}  ${entry.file}`)
        .join('\n');
      if (integrity?.aggregate_sha256 !== sha256(Buffer.from(aggregateLines, 'utf8'))) {
        errors.push('packet integrity aggregate_sha256 mismatch');
      }
    }
  }

  if (!declaredDependencyPinsMatch(manifest)) {
    errors.push('manifest accepted dependency pins drift from validator pins');
  }

  for (const [relativePath, expectedDigest] of Object.entries(
    ACCEPTED_DEPENDENCY_PINS,
  )) {
    if (fileSha256(join(root, relativePath)) !== expectedDigest) {
      errors.push(`${relativePath}: accepted dependency bytes drifted`);
    } else {
      counts.acceptedDependenciesPinned += 1;
    }
  }

  for (const relativePath of [
    'docs/adr/ADR-0012-resource-bounds-contract-profile.md',
    'docs/architecture/resource-bounds/README.md',
    'docs/architecture/resource-bounds/01-contract-semantics.md',
    'docs/architecture/resource-bounds/02-deterministic-replay-and-evidence.md',
  ]) {
    const absolutePath = join(root, relativePath);
    if (!existsSync(absolutePath)) {
      errors.push(`${relativePath}: missing`);
      continue;
    }
    const text = readFileSync(absolutePath, 'utf8');
    // R5 moves the lifecycle to accepted; the NOT IMPLEMENTED ceiling stays.
    for (const required of [ACCEPTED_LIFECYCLE, 'NOT IMPLEMENTED']) {
      if (!text.includes(required)) errors.push(`${relativePath}: missing ${required}`);
    }
    if (/\b(?:runtime|UAT|production) (?:verified|proven|ready)\b/i.test(text)) {
      errors.push(`${relativePath}: runtime/UAT/production overclaim`);
    }
  }

  return {
    errors,
    status,
    notAccepted,
    notImplemented,
    packetVersion,
    gate,
    gateDisposition,
    counts,
  };
}

export function formatResourceBoundsReport(report) {
  const payload = {
    status: report.status ?? 'UNKNOWN',
    not_accepted: report.notAccepted ?? null,
    not_implemented: report.notImplemented ?? null,
    gate: report.gate ?? 'UNKNOWN',
    counts: report.counts,
  };
  if (report.errors.length > 0) {
    return {
      exitCode: 1,
      stdout: '',
      stderr:
        `RESOURCE-BOUNDS CONTRACT VALIDATION: FAIL\n${JSON.stringify(payload)}\n`
        + report.errors.map((error) => `- ${error}`).join('\n')
        + '\n',
    };
  }
  return {
    exitCode: 0,
    stdout:
      `RESOURCE-BOUNDS CONTRACT VALIDATION: PASS\n${JSON.stringify(payload)}\n`
      + `${ACCEPTED_LIFECYCLE}. Static L1/L2 conformance only; no runtime, UAT, T10/T11, release, deployment, or production proof.\n`,
    stderr: '',
  };
}

const isMainModule = () => {
  if (!process.argv[1]) return false;
  try {
    return pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
  } catch {
    return false;
  }
};

if (isMainModule()) {
  const rendered = formatResourceBoundsReport(
    validateResourceBoundsProposal({ root: DEFAULT_ROOT }),
  );
  process.stdout.write(rendered.stdout);
  process.stderr.write(rendered.stderr);
  process.exitCode = rendered.exitCode;
}
