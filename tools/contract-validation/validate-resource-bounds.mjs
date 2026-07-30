// Gate W2-H resource-bounds proposal validator.
//
// Deterministic Suite-side static conformance only. This file is not product
// runtime code and a green result accepts no ADR, proves no UAT/runtime, and
// grants no release or production authority.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, '../..');
const CONTRACTS_ROOT = 'contracts/';

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
  'contracts/json-schema/cybrik.res-bounds-error.v1.schema.json',
];

const POSITIVE_PATHS = [
  'contracts/examples/resource-bounds/positive/bounds-grant.root.json',
  'contracts/examples/resource-bounds/positive/reservation-request.child.json',
  'contracts/examples/resource-bounds/positive/reservation-result.admitted.json',
  'contracts/examples/resource-bounds/positive/reservation-result.denied.json',
  'contracts/examples/resource-bounds/positive/release.completed.json',
  'contracts/examples/resource-bounds/positive/replay.conserved-tree.json',
];

const NEGATIVE_SCHEMA_PATHS = [
  'contracts/examples/resource-bounds/negative-schema/bounds-grant.authority-token.json',
  'contracts/examples/resource-bounds/negative-schema/bounds-grant.empty-vector.json',
  'contracts/examples/resource-bounds/negative-schema/reservation-request.zero-vector.json',
  'contracts/examples/resource-bounds/negative-schema/reservation-request.short-idempotency-key.json',
  'contracts/examples/resource-bounds/negative-schema/reservation-result.admitted-with-error.json',
  'contracts/examples/resource-bounds/negative-schema/reservation-result.denied-with-reservation.json',
  'contracts/examples/resource-bounds/negative-schema/release.missing-accounting.json',
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

const canonicalRequestDigest = (request) =>
  sha256(Buffer.from(JSON.stringify(request), 'utf8'));

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

  const fail = (code) => replayFailure({ code, trace, root });
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

      const requestDigest = canonicalRequestDigest(request);
      const resultDigest = canonicalRequestDigest(result);
      const prior = idempotency.get(request.idempotency_key);
      if (prior && prior.requestDigest !== requestDigest) {
        return fail('RES_IDEMPOTENCY_CONFLICT');
      }
      if (prior) {
        if (prior.resultDigest !== resultDigest) {
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

      const parent = getParent(request.parent);
      if (!parent) return fail('RES_PARENT_NOT_FOUND');
      if (parent.closed) return fail('RES_PARENT_CLOSED');
      if (request.parent.expected_version !== parent.version) {
        return fail('RES_VERSION_CONFLICT');
      }
      if (!vectorLessThanOrEqual(request.requested, parent.remaining)) {
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
      idempotency.set(request.idempotency_key, {
        requestDigest,
        resultDigest,
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

    if (event.kind === 'cancel-root') {
      const cancel = event.payload ?? {};
      if (cancel.tenant_id !== context.tenant_id) {
        return fail('RES_TENANT_MISMATCH');
      }
      if (!isDeepStrictEqual(cancel.org_scope_ref, context.org_scope_ref)) {
        return fail('RES_ORG_SCOPE_MISMATCH');
      }
      if (cancel.grant_id !== root.grantId) return fail('RES_PARENT_NOT_FOUND');
      root.closed = true;
      root.remaining = zeroVector();
      root.version += 1;
      for (const reservation of reservations.values()) {
        reservation.closed = true;
        reservation.remaining = zeroVector();
        reservation.version += 1;
      }
      trace.push({
        kind: 'cancel-root',
        sequence: event.sequence,
        virtualTimeMs: event.virtual_time_ms,
        admitted: true,
        rootClosed: true,
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

  if (status !== 'PROPOSED') errors.push('manifest status must be PROPOSED');
  if (notAccepted !== true) errors.push('manifest must say not accepted');
  if (notImplemented !== true) errors.push('manifest must say not implemented');
  if (packetVersion !== '0.1.0') errors.push('packet version must be 0.1.0');
  if (manifest?.['x-cybrik-is-bundle-tag'] !== false) {
    errors.push('proposal must not be an immutable bundle tag');
  }
  if (gate !== 'W2-H') errors.push('manifest gate id must be W2-H');
  if (gateDisposition !== 'OPEN FOR BOUNDED PROPOSAL WRITING ONLY') {
    errors.push('manifest gate disposition is not proposal-only');
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
    for (const required of ['PROPOSED', 'NOT ACCEPTED', 'NOT IMPLEMENTED']) {
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
        `RESOURCE-BOUNDS PROPOSAL VALIDATION: FAIL\n${JSON.stringify(payload)}\n`
        + report.errors.map((error) => `- ${error}`).join('\n')
        + '\n',
    };
  }
  return {
    exitCode: 0,
    stdout:
      `RESOURCE-BOUNDS PROPOSAL VALIDATION: PASS\n${JSON.stringify(payload)}\n`
      + 'PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED. Static L1/L2 conformance only; no runtime, UAT, T10/T11, release, deployment, or production proof.\n',
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
