// Standalone validator for the W1 investigation lifecycle/transport packet.
//
// The packet carries the W1-C2 v0.1.0 lifecycle contract plus the W1-REC-3/4
// Bundle decision: strict-compatible v0.1.1 is accepted and authoritative for
// new bundle-read responses, while exact v0.1.0 bytes remain immutable supported
// legacy read/replay input. Consumer migration remains separately gated by
// W1-REC-5. This tool fails closed on any half-flip or lifecycle annotation drift.
//
// This tool deliberately does not join the accepted packet orchestrator. Exit 0 proves only
// packet-document consistency, ref resolution and fixture behavior; it does not prove a
// product runtime or authorize CI wiring, deploy, or release.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, '../..');
const ACCEPTED_STATUS = 'ACCEPTED FOR IMPLEMENTATION';
const PROPOSAL_VERSION = '0.1.0';
const LEGACY_BUNDLE_STATUS =
  'ACCEPTED FOR IMPLEMENTATION — immutable legacy read/replay — byte-unchanged';
const NEW_RESPONSE_BUNDLE_STATUS =
  'ACCEPTED FOR IMPLEMENTATION — authoritative for new bundle-read responses';
const ACCEPTED_BUNDLE_SHA256 =
  '501cb160f2fe7035c824d5b0ab37b74d5624cf99a7c25c7adffa72dff9c53bb1';
const GATE_STATUS =
  'DECIDED — ACCEPTED FOR IMPLEMENTATION (packet v0.1.0; Bundle v0.1.1 authoritative for new responses; legacy v0.1.0 supported; not stable v1/GA)';
const STRICT_COMPATIBLE_SCHEMA_PATH =
  'contracts/json-schema/cybrik.investigation-bundle.strict-compatible.v1.schema.json';
const ACCEPTED_BUNDLE_SCHEMA_PATH =
  'contracts/json-schema/cybrik.investigation-bundle.v1.schema.json';
const CONTRACTS_PATH_ROOT = 'contracts/';
const PACKET_INTEGRITY_KEY = 'x-cybrik-packet-integrity';
const PACKET_MEMBER_COUNT = 30;
const STALE_LIFECYCLE_PATTERN =
  /\bproposed\b|\bnot(?:\s+yet)?\s+accepted\b|\bonly\s+proposed\b/i;
const UNAUTHORIZED_PROMOTION_CLAIM_PATTERN =
  /\b(?:now|is|becomes?)\s+(?:stable\s+v1|GA|implemented)\b|(?<!no automatic )(?<!no )\bconsumer migration\s+(?:is\s+)?authorized\b|\bruntime authority\s+(?:is\s+)?granted\b|\bCI\s+(?:is\s+)?wired\b/i;
const MANIFEST_STATUS_CONTAINER_PATHS = new Set([
  'collision_status_map',
  'state_machine.record_status_mapping',
]);

const expectedManifestTopLevelKeys = [
  '$schema',
  '$id',
  'title',
  'description',
  'x-cybrik-status',
  'x-cybrik-not-accepted',
  'x-cybrik-packet-version',
  'x-cybrik-is-bundle-tag',
  'format_pins',
  'collision_status_map',
  'ownership',
  'members',
  'reuses_unmodified',
  'supersession_mapping',
  'operation_contract',
  'event_contract',
  'state_machine',
  'runtime_invariants',
  'authority_invariants',
  'open_decisions',
  'verification_commands',
  PACKET_INTEGRITY_KEY,
  'gate',
  'acceptance_record',
].sort();

const expectedOwnership = {
  cyber_ai:
    'Sole lifecycle state authority, checkpoint/event producer, retry/cancel race arbiter, and Investigation Bundle producer.',
  soc:
    'Authorized requestor, consumer, and viewer of lifecycle status/checkpoints/bundles under SOC-owned analyst/tenant/org truth. SOC cannot mint lifecycle state or rewrite a bundle.',
  fabric:
    'No member of this packet is Fabric execution authority. Fabric remains sole owner of capability registry, invocation, policy/approval, credential/egress broker, sandbox and execution receipts.',
  suite:
    'Owns this accepted cross-product contract packet and its compatibility/conformance evidence only; it gains no product-runtime or release authority.',
};

const expectedRuntimeInvariantStatements = [
  'Authoritative tenant and actor derive from authenticated identity; any body/actor/credential tenant mismatch is rejected.',
  'Authoritative org scope derives from identity plus policy; advisory org_scope never expands visibility and a mismatch is rejected.',
  'Idempotency is scoped to authenticated principal plus key plus normalized body. Same triple returns the same result; same principal/key with different content returns idempotency_conflict.',
  'Cancellation is compare-and-set on expected_version. A stale version loses; exactly one state transition wins a cancellation/checkpoint/completion race.',
  'Terminal attempts are immutable. Late cancellation/checkpoints return or observe current truth and never rewrite state, drop checkpoints, or discard Fabric receipts.',
  'Checkpoint sequence is strictly increasing per attempt. Retry creates a fresh attempt_id linked to the prior attempt and starts sequence at one; no prior attempt is mutated.',
  'Status, checkpoint, event, and bundle-read markings never downgrade authoritative input/artifact markings on either classification or TLP axis.',
  'Unknown and unauthorized investigation ids are indistinguishable in HTTP class, JSON shape, sanitized message policy, and timing policy; no existence, owner, tenant, org, grant, or policy detail leaks. The positive not-found plus negative existence-leak fixtures verify only the static shape/message/no-target-identifier portion; timing indistinguishability remains an explicit runtime-only obligation and is not claimed as fixture-verified.',
];

const schemaPaths = [
  'contracts/json-schema/cybrik.investigation-lifecycle-common-defs.v1.schema.json',
  'contracts/json-schema/cybrik.investigation-create-request.v1.schema.json',
  'contracts/json-schema/cybrik.investigation-status.v1.schema.json',
  'contracts/json-schema/cybrik.investigation-checkpoint.v1.schema.json',
  'contracts/json-schema/cybrik.investigation-cancel-request.v1.schema.json',
  'contracts/json-schema/cybrik.investigation-bundle.strict-compatible.v1.schema.json',
  'contracts/json-schema/cybrik.investigation-bundle-read-result.v1.schema.json',
  'contracts/json-schema/cybrik.investigation-lifecycle-error.v1.schema.json',
];

const schemaVersions = new Map(
  schemaPaths.map((relativePath) => [
    relativePath,
    relativePath.endsWith('cybrik.investigation-bundle.strict-compatible.v1.schema.json')
      ? '0.1.1'
      : PROPOSAL_VERSION,
  ]),
);

const fixturePaths = [
  'contracts/examples/investigation-lifecycle/positive/investigation-create-request.json',
  'contracts/examples/investigation-lifecycle/positive/investigation-status.cancelled.json',
  'contracts/examples/investigation-lifecycle/positive/investigation-checkpoint.json',
  'contracts/examples/investigation-lifecycle/positive/investigation-cancel-request.json',
  'contracts/examples/investigation-lifecycle/positive/investigation-bundle-read-result.json',
  'contracts/examples/investigation-lifecycle/positive/investigation-lifecycle-error.not-found.json',
  'contracts/examples/investigation-lifecycle/negative-schema/investigation-create-request.short-idempotency.json',
  'contracts/examples/investigation-lifecycle/negative-schema/investigation-create-request.tool-authority.json',
  'contracts/examples/investigation-lifecycle/negative-schema/investigation-cancel-request.missing-version.json',
  'contracts/examples/investigation-lifecycle/negative-schema/investigation-checkpoint.sequence-zero.json',
  'contracts/examples/investigation-lifecycle/negative-schema/investigation-lifecycle-error.existence-leak.json',
  'contracts/examples/investigation-lifecycle/negative-semantic/investigation-create-request.cross-tenant.json',
  'contracts/examples/investigation-lifecycle/negative-semantic/investigation-status.org-mismatch.json',
  'contracts/examples/investigation-lifecycle/negative-semantic/investigation-create-request.idempotency-conflict.json',
  'contracts/examples/investigation-lifecycle/negative-semantic/investigation-cancel-request.stale-version.json',
  'contracts/examples/investigation-lifecycle/negative-semantic/investigation-cancel-request.terminal-race.json',
  'contracts/examples/investigation-lifecycle/negative-semantic/investigation-checkpoint.retry-mutates-terminal-attempt.json',
  'contracts/examples/investigation-lifecycle/negative-semantic/investigation-bundle-read-result.marking-downgrade.json',
];

export const expectedPacketPaths = [
  ...schemaPaths,
  'contracts/openapi/cybrik-ai-investigation-lifecycle-proposal.v1.openapi.yaml',
  'contracts/asyncapi/cybrik-ai-investigation-lifecycle-proposal.v1.asyncapi.yaml',
  'contracts/compatibility/cybrik-suite-investigation-lifecycle-proposal.v1.manifest.json',
  'contracts/examples/investigation-lifecycle/examples-manifest.json',
  ...fixturePaths,
];

const acceptedRefPaths = [
  'contracts/json-schema/cybrik.common-defs.v1.schema.json',
  'contracts/json-schema/cybrik.data-marking.v1.schema.json',
  'contracts/json-schema/cybrik.investigation-common-defs.v1.schema.json',
  'contracts/json-schema/cybrik.investigation-bundle.v1.schema.json',
];

// ---------------------------------------------------------------------------
// Packet integrity. Every one of the 30 packet members carries a sha256, and the
// aggregate consumes only those 30 digests. The manifest cannot hash its own bytes
// without a circular definition, so its member digest is taken over the manifest
// value with the integrity block removed — no digest input ever contains a digest.
// ---------------------------------------------------------------------------

export const expectedPacketIntegrityDeclaration = {
  algorithm: 'sha256',
  member_count: PACKET_MEMBER_COUNT,
  path_root: CONTRACTS_PATH_ROOT,
  file_digest_rule: "Every member except this manifest is digested as the lowercase hex SHA-256 of the exact on-disk UTF-8 bytes of '<path_root><file>'.",
  self_digest_rule: "This manifest's own member digest is deliberately NOT taken over its on-disk bytes. It is the lowercase hex SHA-256 of the UTF-8 encoding of JSON.stringify(this manifest parsed as JSON with the top-level 'x-cybrik-packet-integrity' key removed). Because the hashed input excludes the integrity block, no digest input ever contains a digest, which is what makes the self entry and the aggregate below non-circular and independently reproducible. Consequence, stated deliberately: for this one member the digest pins the JSON value, not the on-disk byte formatting.",
  aggregate_algorithm: "Sort all 30 member entries ascending by 'file' using JavaScript default string comparison, render each entry as the line '<sha256>  <file>' (two spaces), join the lines with a single '\\n' and no trailing newline, then take the lowercase hex SHA-256 of the UTF-8 encoding of that string. The aggregate consumes only the 30 member digests, so it never depends on its own value.",
};

export const expectedVerificationCommands = {
  workspace: 'tools/contract-validation',
  workspace_note: 'Every command below is run with tools/contract-validation as the working directory, in a checkout whose already-pinned validation dependencies (@asyncapi/parser 3.6.0, @stoplight/spectral-cli 6.16.2, ajv 8.20.0, ajv-formats 3.0.1) are installed. This packet installs nothing, adds no dependency, and reaches no network.',
  ci_wiring: 'NOT WIRED — these commands are declared for reproducible manual and reviewer execution only. Registering them in the canonical validation orchestrator (tools/contract-validation/validate.mjs, package.json scripts) and in CI is a later integration gate that is deliberately out of scope for this packet, and no CI result is claimed here.',
  standalone_validator: 'node validate-investigation-lifecycle-proposal.mjs',
  tests: 'node --test tests/validate-investigation-lifecycle-proposal.test.mjs',
  tests_branch_coverage: 'node --experimental-test-coverage --test tests/validate-investigation-lifecycle-proposal.test.mjs',
  ajv_strict: 'node --test --test-name-pattern "official Ajv 2020-12 strict mode" tests/validate-investigation-lifecycle-proposal.test.mjs',
  spectral_openapi: 'node_modules/.bin/spectral lint --ruleset .spectral.yaml --fail-severity error --format stylish ../../contracts/openapi/cybrik-ai-investigation-lifecycle-proposal.v1.openapi.yaml',
  asyncapi: 'node --input-type=module --eval "import { Parser, fromFile } from \'@asyncapi/parser\'; const target = \'../../contracts/asyncapi/cybrik-ai-investigation-lifecycle-proposal.v1.asyncapi.yaml\'; const { document, diagnostics } = await fromFile(new Parser(), target).parse(); const errors = (diagnostics ?? []).filter((d) => d.severity === 0); for (const d of errors) console.error(\'ERROR \' + d.message); if (!document || errors.length > 0) process.exit(1); console.log(\'OK AsyncAPI 3.0.0 errors=0\');"',
};

// Phrases the successor-scope prose must and must not carry. The accepted v0.1.0 is spec-valid;
// only Ajv's optional strict mode rejects its bare `required` branch.
const supersessionRequiredPhrases = [
  'accepted v0.1.1 successor selected by W1-REC-3/4',
  'remains fully JSON Schema 2020-12 conformant',
  'bare subschema {"required":["tenant_id"]}',
  "Ajv's optional strict-mode house style",
  'newly written into allOf[1]',
  'semantically redundant',
];
const strictBundleRequiredPhrases = [
  'ACCEPTED FOR IMPLEMENTATION v0.1.1 under W1-REC-3/4',
  'authoritative for new bundle-read responses',
  'immutable supported legacy read/replay input',
  'fully JSON Schema 2020-12 conformant',
  "only Ajv's optional strict mode rejects",
  'did not previously exist in allOf[1]',
  'consumer migration remains separately gated by W1-REC-5',
];
const inaccurateSuccessorPhrases = [
  'already-existing tenant_id',
  'type=object/tenant_id property annotation',
];

const expectedManifestStatusEntries = new Map([
  ['x-cybrik-not-accepted', false],
  ['x-cybrik-packet-version', PROPOSAL_VERSION],
  ['x-cybrik-status', ACCEPTED_STATUS],
  ...Array.from(
    { length: 4 },
    (_, index) => [
      `collision_status_map.existing_boundaries.${index}.status`,
      'ACCEPTED FOR IMPLEMENTATION v0.1.0, not stable v1/GA',
    ],
  ),
  ...Array.from(
    { length: 10 },
    (_, index) => [`members.${index}.status`, ACCEPTED_STATUS],
  ),
  ['supersession_mapping.accepted_current.status', LEGACY_BUNDLE_STATUS],
  ['supersession_mapping.accepted_successor.status', NEW_RESPONSE_BUNDLE_STATUS],
  ['gate.status', GATE_STATUS],
]);

const openApiLifecycleFragments = [
  '# Bundle v0.1.1: ACCEPTED FOR IMPLEMENTATION under W1-REC-3/4 and authoritative for new bundle-read responses.',
  '# Bundle v0.1.0: immutable supported legacy read/replay input; exact accepted bytes remain unchanged.',
  '# Consumer migration remains separately gated by W1-REC-5.',
  'summary: ACCEPTED FOR IMPLEMENTATION v0.1.0 packet; Bundle v0.1.1 is authoritative for new bundle-read responses under W1-REC-3/4 — NOT IMPLEMENTED, CI NOT WIRED.',
  'x-cybrik-status: ACCEPTED FOR IMPLEMENTATION',
  'x-cybrik-not-accepted: false',
  'Read the accepted strict-compatible v0.1.1 Investigation Bundle through Cyber AI.',
  'v0.1.0 remains immutable supported',
  'legacy read/replay input, and consumer migration remains separately gated by W1-REC-5.',
];

const asyncApiLifecycleFragments = [
  '# Bundle v0.1.1: ACCEPTED FOR IMPLEMENTATION under W1-REC-3/4 and authoritative for new bundle publications.',
  '# Bundle v0.1.0: immutable supported legacy read/replay input; exact accepted bytes remain unchanged.',
  '# Consumer migration remains separately gated by W1-REC-5.',
  'title: CYBRIK AI investigation lifecycle event contract',
  'ACCEPTED FOR IMPLEMENTATION v0.1.0 packet; Bundle v0.1.1 is authoritative for new bundle',
  'read/replay input, and consumer migration remains separately gated by W1-REC-5.',
  'x-cybrik-status: ACCEPTED FOR IMPLEMENTATION',
  'x-cybrik-not-accepted: false',
  'data is the accepted v0.1.1 bundle authoritative for new publications.',
];

const collectManifestStatusEntries = (value, path = [], output = []) => {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      collectManifestStatusEntries(entry, [...path, String(index)], output);
    });
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  for (const [name, child] of Object.entries(value)) {
    const childPath = [...path, name];
    const childPathText = childPath.join('.');
    if (
      (
        /status/i.test(name)
        && !MANIFEST_STATUS_CONTAINER_PATHS.has(childPathText)
        || name === 'x-cybrik-not-accepted'
        || name === 'x-cybrik-packet-version'
      )
    ) {
      output.push([childPathText, child]);
    }
    collectManifestStatusEntries(child, childPath, output);
  }
  return output;
};

const collectSchemaLifecycleAnnotations = (value, path = [], output = []) => {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      collectSchemaLifecycleAnnotations(entry, [...path, String(index)], output);
    });
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  for (const [name, child] of Object.entries(value)) {
    const childPath = [...path, name];
    if (
      [
        'x-cybrik-status',
        'x-cybrik-not-accepted',
        'x-cybrik-contract-version',
      ].includes(name)
    ) {
      output.push([childPath.join('.'), child]);
    }
    collectSchemaLifecycleAnnotations(child, childPath, output);
  }
  return output;
};

const countLiteral = (text, literal) => text.split(literal).length - 1;

const sha256Hex = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

const manifestStaleLifecycleScanText = (manifestDocument) => {
  const scanDocument = JSON.parse(JSON.stringify(manifestDocument));
  const historicalQuestion = scanDocument?.open_decisions?.[0]?.question;
  if (historicalQuestion?.startsWith('HISTORICAL W1-C2 QUESTION')) {
    scanDocument.open_decisions[0].question = 'HISTORICAL W1-C2 QUESTION';
  }
  return JSON.stringify(scanDocument);
};

const manifestSelfDigestInput = (manifestDocument) => {
  const withoutIntegrity = { ...manifestDocument };
  delete withoutIntegrity[PACKET_INTEGRITY_KEY];
  return JSON.stringify(withoutIntegrity);
};

const aggregatePacketDigest = (memberDigests) => sha256Hex(
  [...memberDigests]
    .sort((left, right) => {
      if (left.file < right.file) return -1;
      if (left.file > right.file) return 1;
      return 0;
    })
    .map((entry) => `${entry.sha256}  ${entry.file}`)
    .join('\n'),
);

export {
  aggregatePacketDigest as computePacketAggregateDigest,
  manifestSelfDigestInput as computeManifestSelfDigestInput,
};

const jsonPointer = (document, fragment) => {
  if (!fragment || fragment === '#') return document;
  if (!fragment.startsWith('#/')) return undefined;
  return fragment
    .slice(2)
    .split('/')
    .map((token) => token.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce((value, token) => value?.[token], document);
};

const typeMatches = (type, value) => {
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'array') return Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'string') return typeof value === 'string';
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'null') return value === null;
  return true;
};

const deepEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function validateValue(schema, value, context, path = '$') {
  const errors = [];
  if (!schema || typeof schema !== 'object') return [`${path}: schema is not an object`];

  if (schema.$ref) {
    const [fileName, fragment = ''] = schema.$ref.split('#');
    const targetDocument = fileName
      ? context.schemas.get(fileName)
      : context.currentDocument;
    const targetSchema = jsonPointer(targetDocument, `#${fragment}`);
    if (!targetDocument || !targetSchema) {
      errors.push(`${path}: unresolved $ref ${schema.$ref}`);
    } else {
      errors.push(
        ...validateValue(targetSchema, value, {
          ...context,
          currentDocument: targetDocument,
        }, path),
      );
    }
  }

  for (const member of schema.allOf || []) {
    errors.push(...validateValue(member, value, context, path));
  }
  if (schema.anyOf) {
    const outcomes = schema.anyOf.map((member) => validateValue(member, value, context, path));
    if (!outcomes.some((outcome) => outcome.length === 0)) {
      errors.push(`${path}: no anyOf branch matched`);
    }
  }
  if (schema.if) {
    const conditionMatches = validateValue(schema.if, value, context, path).length === 0;
    if (conditionMatches && schema.then) {
      errors.push(...validateValue(schema.then, value, context, path));
    }
    if (!conditionMatches && schema.else) {
      errors.push(...validateValue(schema.else, value, context, path));
    }
  }

  const allowedTypes = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (allowedTypes.length > 0 && !allowedTypes.some((type) => typeMatches(type, value))) {
    return [...errors, `${path}: expected type ${allowedTypes.join('|')}`];
  }
  if (schema.const !== undefined && !deepEqual(schema.const, value)) {
    errors.push(`${path}: value differs from const`);
  }
  if (schema.enum && !schema.enum.some((entry) => deepEqual(entry, value))) {
    errors.push(`${path}: value is outside enum`);
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${path}: shorter than minLength ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${path}: longer than maxLength ${schema.maxLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${path}: does not match pattern`);
    }
    if (schema.format === 'date-time' && Number.isNaN(Date.parse(value))) {
      errors.push(`${path}: invalid date-time`);
    }
    if (
      schema.format === 'uuid'
      && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ) {
      errors.push(`${path}: invalid UUID`);
    }
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${path}: below minimum ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${path}: above maximum ${schema.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${path}: fewer than minItems ${schema.minItems}`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${path}: more than maxItems ${schema.maxItems}`);
    }
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) {
      errors.push(`${path}: duplicate array entries`);
    }
    if (schema.items) {
      value.forEach((item, index) => {
        errors.push(...validateValue(schema.items, item, context, `${path}[${index}]`));
      });
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const required of schema.required || []) {
      if (!Object.hasOwn(value, required)) errors.push(`${path}: missing required '${required}'`);
    }
    for (const [name, childValue] of Object.entries(value)) {
      if (schema.properties?.[name]) {
        errors.push(
          ...validateValue(
            schema.properties[name],
            childValue,
            context,
            `${path}.${name}`,
          ),
        );
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}: additional property '${name}'`);
      }
    }
  }

  return errors;
}

export { validateValue as validateJsonSchemaValue };

const collectRefs = (value, output = []) => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectRefs(item, output));
  } else if (value && typeof value === 'object') {
    if (typeof value.$ref === 'string') output.push(value.$ref);
    Object.values(value).forEach((item) => collectRefs(item, output));
  }
  return output;
};

const collectPropertyNames = (value, output = []) => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectPropertyNames(item, output));
  } else if (value && typeof value === 'object') {
    if (value.properties && typeof value.properties === 'object') {
      output.push(...Object.keys(value.properties));
    }
    Object.values(value).forEach((item) => collectPropertyNames(item, output));
  }
  return output;
};

export async function validateInvestigationLifecycleProposal({
  root = DEFAULT_ROOT,
  overrides = new Map(),
} = {}) {
  const errors = [];
  const texts = new Map();
  const documents = new Map();
  const readText = (relativePath) => {
    if (overrides.has(relativePath)) return overrides.get(relativePath);
    const absolutePath = join(root, relativePath);
    if (!existsSync(absolutePath)) {
      errors.push(`missing expected packet file: ${relativePath}`);
      return undefined;
    }
    return readFileSync(absolutePath, 'utf8');
  };
  const readJson = (relativePath) => {
    const text = readText(relativePath);
    if (text === undefined) return undefined;
    texts.set(relativePath, text);
    try {
      const document = JSON.parse(text);
      documents.set(relativePath, document);
      return document;
    } catch (error) {
      errors.push(`${relativePath}: JSON parse failed: ${error.message}`);
      return undefined;
    }
  };

  for (const relativePath of expectedPacketPaths) {
    if (relativePath.endsWith('.json')) readJson(relativePath);
    else {
      const text = readText(relativePath);
      if (text !== undefined) texts.set(relativePath, text);
    }
  }
  for (const relativePath of acceptedRefPaths) readJson(relativePath);

  const compatibilityPath =
    'contracts/compatibility/cybrik-suite-investigation-lifecycle-proposal.v1.manifest.json';
  const examplesPath = 'contracts/examples/investigation-lifecycle/examples-manifest.json';
  const openApiPath =
    'contracts/openapi/cybrik-ai-investigation-lifecycle-proposal.v1.openapi.yaml';
  const asyncApiPath =
    'contracts/asyncapi/cybrik-ai-investigation-lifecycle-proposal.v1.asyncapi.yaml';
  const compatibility = documents.get(compatibilityPath);
  const examples = documents.get(examplesPath);
  const openApi = texts.get(openApiPath) || '';
  const asyncApi = texts.get(asyncApiPath) || '';

  if (
    compatibility?.['x-cybrik-status'] !== ACCEPTED_STATUS
    || compatibility?.['x-cybrik-not-accepted'] !== false
  ) {
    errors.push('compatibility manifest must record the W1-C2 acceptance (ACCEPTED FOR IMPLEMENTATION, x-cybrik-not-accepted=false)');
  }
  if (compatibility?.['x-cybrik-packet-version'] !== PROPOSAL_VERSION) {
    errors.push(`compatibility manifest packet version must remain ${PROPOSAL_VERSION}`);
  }
  if (compatibility?.['x-cybrik-is-bundle-tag'] !== false) {
    errors.push('proposal cannot be an immutable bundle tag');
  }
  if (compatibility) {
    if (
      !deepEqual(Object.keys(compatibility).sort(), expectedManifestTopLevelKeys)
      || STALE_LIFECYCLE_PATTERN.test(manifestStaleLifecycleScanText(compatibility))
      || UNAUTHORIZED_PROMOTION_CLAIM_PATTERN.test(JSON.stringify(compatibility))
    ) {
      errors.push(
        `${compatibilityPath}: unknown top-level locus or stale lifecycle wording is forbidden`,
      );
    }
    if (compatibility.title !== 'CYBRIK W1 investigation lifecycle and transport proposal v1') {
      errors.push(`${compatibilityPath}: title must remain the reviewed contract-packet title`);
    }
    const actualStatusEntries = collectManifestStatusEntries(compatibility)
      .sort(([left], [right]) => left.localeCompare(right));
    const expectedStatusEntries = [...expectedManifestStatusEntries.entries()]
      .sort(([left], [right]) => left.localeCompare(right));
    if (!deepEqual(actualStatusEntries, expectedStatusEntries)) {
      errors.push(
        `${compatibilityPath}: lifecycle status annotation inventory must match the exact W1-C2 plus W1-REC-3/4 selection`,
      );
    }
  }

  const packetIntegrity = compatibility?.[PACKET_INTEGRITY_KEY];
  if (!packetIntegrity || typeof packetIntegrity !== 'object' || Array.isArray(packetIntegrity)) {
    if (compatibility) {
      errors.push(`${compatibilityPath}: must declare a sha256 packet integrity block`);
    }
  } else {
    for (const [field, expectedValue] of Object.entries(expectedPacketIntegrityDeclaration)) {
      if (!deepEqual(packetIntegrity[field], expectedValue)) {
        errors.push(
          `${compatibilityPath}: packet integrity declaration field '${field}' must match the reviewed rule verbatim`,
        );
      }
    }
    const declaredMemberDigests = Array.isArray(packetIntegrity.member_digests)
      ? packetIntegrity.member_digests
      : [];
    const declaredMemberFileNames = declaredMemberDigests
      .map((entry) => entry?.file)
      .sort();
    const expectedMemberFileNames = expectedPacketPaths
      .map((relativePath) => relativePath.slice(CONTRACTS_PATH_ROOT.length))
      .sort();
    if (
      new Set(declaredMemberFileNames).size !== declaredMemberFileNames.length
      || !deepEqual(declaredMemberFileNames, expectedMemberFileNames)
      || declaredMemberDigests.some((entry) => !/^[0-9a-f]{64}$/.test(entry?.sha256 ?? ''))
    ) {
      errors.push(
        `${compatibilityPath}: packet integrity member set must be the exact unique thirty-member packet inventory of lowercase sha256 digests`,
      );
    }
    const recomputedMemberDigests = [];
    for (const relativePath of expectedPacketPaths) {
      const memberFile = relativePath.slice(CONTRACTS_PATH_ROOT.length);
      const memberDigest = relativePath === compatibilityPath
        ? sha256Hex(manifestSelfDigestInput(compatibility))
        : texts.has(relativePath) ? sha256Hex(texts.get(relativePath)) : undefined;
      if (memberDigest === undefined) continue;
      recomputedMemberDigests.push({ file: memberFile, sha256: memberDigest });
      const declared = declaredMemberDigests.find((entry) => entry?.file === memberFile);
      if (declared && declared.sha256 !== memberDigest) {
        errors.push(`${memberFile}: packet member sha256 mismatch`);
      }
    }
    if (
      recomputedMemberDigests.length === PACKET_MEMBER_COUNT
      && packetIntegrity.aggregate_sha256 !== aggregatePacketDigest(recomputedMemberDigests)
    ) {
      errors.push(`${compatibilityPath}: packet aggregate digest mismatch`);
    }
  }

  const verificationCommands = compatibility?.verification_commands;
  const expectedVerificationCommandFields = Object.keys(expectedVerificationCommands);
  if (
    !verificationCommands
    || typeof verificationCommands !== 'object'
    || !deepEqual(
      Object.keys(verificationCommands).sort(),
      [...expectedVerificationCommandFields].sort(),
    )
    || expectedVerificationCommandFields.some(
      (field) => verificationCommands[field] !== expectedVerificationCommands[field],
    )
  ) {
    if (compatibility) {
      errors.push(`${compatibilityPath}: must declare the exact reviewed verification commands`);
    }
  }
  if (
    compatibility
    && (
      typeof verificationCommands?.ci_wiring !== 'string'
      || !verificationCommands.ci_wiring.startsWith('NOT WIRED')
    )
  ) {
    errors.push(
      `${compatibilityPath}: canonical CI wiring is a later integration gate and cannot be declared as wired`,
    );
  }

  for (const relativePath of schemaPaths) {
    const document = documents.get(relativePath);
    if (!document) continue;
    if (relativePath === STRICT_COMPATIBLE_SCHEMA_PATH) {
      if (
        document['x-cybrik-status'] !== ACCEPTED_STATUS
        || document['x-cybrik-not-accepted'] !== false
      ) {
        errors.push(`${relativePath}: strict-compatible v0.1.1 must remain ACCEPTED FOR IMPLEMENTATION and authoritative for new responses under W1-REC-3/4`);
      }
    } else if (
      document['x-cybrik-status'] !== ACCEPTED_STATUS
      || document['x-cybrik-not-accepted'] !== false
    ) {
      errors.push(`${relativePath}: must record the W1-C2 acceptance and may not regress to PROPOSED`);
    }
    const expectedSchemaVersion = schemaVersions.get(relativePath);
    if (document['x-cybrik-contract-version'] !== expectedSchemaVersion) {
      errors.push(`${relativePath}: contract version must remain ${expectedSchemaVersion}`);
    }
    if (document.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
      errors.push(`${relativePath}: must pin JSON Schema 2020-12`);
    }
    const lifecycleAnnotations = collectSchemaLifecycleAnnotations(document)
      .sort(([left], [right]) => left.localeCompare(right));
    const expectedLifecycleAnnotations = [
      ['x-cybrik-contract-version', expectedSchemaVersion],
      ['x-cybrik-not-accepted', false],
      ['x-cybrik-status', ACCEPTED_STATUS],
    ].sort(([left], [right]) => left.localeCompare(right));
    if (!deepEqual(lifecycleAnnotations, expectedLifecycleAnnotations)) {
      errors.push(
        `${relativePath}: lifecycle annotation inventory must contain exactly one top-level status, not-accepted flag and contract version`,
      );
    }
  }
  if (
    examples?.['x-cybrik-status'] !== ACCEPTED_STATUS
    || examples?.['x-cybrik-not-accepted'] !== false
  ) {
    errors.push('examples manifest must record the W1-C2 acceptance');
  }
  if (
    examples
    && !deepEqual(
      collectSchemaLifecycleAnnotations(examples)
        .filter(([path]) => path !== 'x-cybrik-contract-version')
        .sort(([left], [right]) => left.localeCompare(right)),
      [
        ['x-cybrik-not-accepted', false],
        ['x-cybrik-status', ACCEPTED_STATUS],
      ].sort(([left], [right]) => left.localeCompare(right)),
    )
  ) {
    errors.push('examples manifest lifecycle status annotation inventory must remain exact');
  }
  for (const fragment of openApiLifecycleFragments) {
    if (!openApi.includes(fragment)) {
      errors.push(`${openApiPath}: lifecycle header/info/bundle-read inventory missing '${fragment}'`);
    }
  }
  if (
    countLiteral(openApi, 'x-cybrik-status:') !== 1
    || countLiteral(openApi, 'x-cybrik-not-accepted:') !== 1
  ) {
    errors.push(`${openApiPath}: lifecycle status annotation inventory must contain exactly one status and one not-accepted flag`);
  }
  if (
    STALE_LIFECYCLE_PATTERN.test(openApi)
    || UNAUTHORIZED_PROMOTION_CLAIM_PATTERN.test(openApi)
  ) {
    errors.push(`${openApiPath}: stale pre-W1-REC Bundle lifecycle wording is forbidden`);
  }
  for (const fragment of asyncApiLifecycleFragments) {
    if (!asyncApi.includes(fragment)) {
      errors.push(`${asyncApiPath}: lifecycle header/info/bundle-publication inventory missing '${fragment}'`);
    }
  }
  if (
    countLiteral(asyncApi, 'x-cybrik-status:') !== 1
    || countLiteral(asyncApi, 'x-cybrik-not-accepted:') !== 1
  ) {
    errors.push(`${asyncApiPath}: lifecycle status annotation inventory must contain exactly one status and one not-accepted flag`);
  }
  if (
    STALE_LIFECYCLE_PATTERN.test(asyncApi)
    || UNAUTHORIZED_PROMOTION_CLAIM_PATTERN.test(asyncApi)
  ) {
    errors.push(`${asyncApiPath}: stale pre-W1-REC Bundle lifecycle wording is forbidden`);
  }

  if (/^servers\s*:/m.test(openApi)) {
    errors.push('OpenAPI proposal must declare no servers');
  }
  if (/(?:^|\n)\s*\/api\/v1\/(?:invocations|capabilities|approvals|receipts)\b/.test(openApi)) {
    errors.push('OpenAPI proposal must not add Fabric execution paths');
  }
  if (/^servers\s*:/m.test(asyncApi)) {
    errors.push('AsyncAPI proposal must declare no servers');
  }
  if (!asyncApi.includes('Cyber AI is the sole producer')) {
    errors.push('AsyncAPI proposal must preserve the Cyber AI producer boundary');
  }
  if (
    !asyncApi.includes(
      "../json-schema/cybrik.investigation-bundle.strict-compatible.v1.schema.json",
    )
    || asyncApi.includes("../json-schema/cybrik.investigation-bundle.v1.schema.json")
  ) {
    errors.push('AsyncAPI bundle publication must bind only accepted strict-compatible v0.1.1 for new publications');
  }

  const operationIds = [...openApi.matchAll(/^\s+operationId:\s*(\S+)\s*$/gm)]
    .map((match) => match[1]);
  const expectedOperations = compatibility?.operation_contract?.operations || [];
  if (!deepEqual([...operationIds].sort(), [...expectedOperations].sort())) {
    errors.push('OpenAPI operationIds must exactly match the five compatibility operations');
  }
  const eventNames = [...asyncApi.matchAll(/^\s+name:\s*(cybrik\.ai\.\S+\.v1)\s*$/gm)]
    .map((match) => match[1]);
  const expectedEvents = compatibility?.event_contract?.events || [];
  if (!deepEqual([...eventNames].sort(), [...expectedEvents].sort())) {
    errors.push('AsyncAPI event names must exactly match the six compatibility events');
  }
  const expectedMemberFiles = [
    ...schemaPaths.map((relativePath) => relativePath.replace('contracts/', '')),
    openApiPath.replace('contracts/', ''),
    asyncApiPath.replace('contracts/', ''),
  ].sort();
  const actualMemberFiles = (compatibility?.members || [])
    .map((member) => member.file)
    .sort();
  if (
    new Set(actualMemberFiles).size !== actualMemberFiles.length
    || !deepEqual(actualMemberFiles, expectedMemberFiles)
  ) {
    errors.push('compatibility member inventory must be the exact unique ten-member contract set');
  }
  if (compatibility?.members?.[5]?.contract_version !== '0.1.1') {
    errors.push('promoted Bundle member contract version must remain 0.1.1');
  }
  const supersession = compatibility?.supersession_mapping;
  if (
    !deepEqual(
      Object.keys(supersession || {}).sort(),
      [
        'accepted_current',
        'accepted_successor',
        'adoption_rule',
        'compatibility',
        'pending_founder_decisions',
        'transport_binding_rule',
      ].sort(),
    )
    ||
    supersession?.accepted_current?.file
      !== 'json-schema/cybrik.investigation-bundle.v1.schema.json'
    || supersession?.accepted_current?.contract_version !== '0.1.0'
    || supersession?.accepted_current?.status
      !== LEGACY_BUNDLE_STATUS
    || supersession?.accepted_successor?.file
      !== 'json-schema/cybrik.investigation-bundle.strict-compatible.v1.schema.json'
    || supersession?.accepted_successor?.contract_version !== '0.1.1'
    || supersession?.accepted_successor?.status !== NEW_RESPONSE_BUNDLE_STATUS
    || !deepEqual(
      supersession?.pending_founder_decisions,
      ['Authorize consumer migration from v0.1.0 to v0.1.1.'],
    )
  ) {
    errors.push('bundle supersession mapping must select accepted v0.1.1 for new responses, preserve legacy v0.1.0 and leave only consumer migration pending');
  }
  const acceptedBundleText = texts.get(ACCEPTED_BUNDLE_SCHEMA_PATH);
  if (
    compatibility
    && supersession?.accepted_current?.sha256 !== ACCEPTED_BUNDLE_SHA256
  ) {
    errors.push(
      'accepted cybrik.investigation-bundle.v1 v0.1.0 must remain the exact admission sha256',
    );
  }
  if (
    compatibility
    && (
      typeof supersession?.accepted_current?.sha256 !== 'string'
      || (
        acceptedBundleText !== undefined
        && sha256Hex(acceptedBundleText) !== supersession.accepted_current.sha256
      )
    )
  ) {
    errors.push('accepted cybrik.investigation-bundle.v1 v0.1.0 bytes must match the supersession-pinned sha256');
  }
  const topDescription = compatibility?.description;
  if (
    typeof topDescription !== 'string'
    || [
      'W1-REC-3/4 accepts',
      'authoritative for new bundle-read responses',
      'immutable supported legacy read/replay input',
      'Consumer migration remains separately gated by W1-REC-5',
      'NOT IMPLEMENTED, CI NOT WIRED',
    ].some((phrase) => !topDescription.includes(phrase))
    || /\bPROPOSED\b|NOT ACCEPTED/.test(topDescription)
  ) {
    errors.push(`${compatibilityPath}: top-level lifecycle description must exactly express W1-REC-3/4, legacy v0.1.0 and W1-REC-5 boundaries`);
  }
  if (
    compatibility?.collision_status_map?.new_namespace
      !== 'cybrik.investigation-lifecycle-* plus create/status/checkpoint/cancel/bundle-read payload names and the accepted cybrik.investigation-bundle.strict-compatible.v1 revision; no existing schema id, path file, event type, or operationId is overwritten.'
    || !Array.isArray(compatibility?.collision_status_map?.existing_boundaries)
    || compatibility.collision_status_map.existing_boundaries.length !== 4
    || compatibility.collision_status_map.existing_boundaries.some(
      (entry) => (
        entry?.status !== 'ACCEPTED FOR IMPLEMENTATION v0.1.0, not stable v1/GA'
        || entry?.collision_result !== 'none'
        || typeof entry?.treatment !== 'string'
        || entry.treatment.length === 0
        || /\bPROPOSED\b|NOT ACCEPTED/.test(entry.treatment)
      ),
    )
    || !compatibility.collision_status_map.existing_boundaries[0]?.treatment
      ?.includes('W1-REC-3/4')
    || !compatibility.collision_status_map.existing_boundaries[0]?.treatment
      ?.includes('immutable supported legacy read/replay input')
    || !compatibility.collision_status_map.existing_boundaries[0]?.treatment
      ?.includes('W1-REC-5')
  ) {
    errors.push(`${compatibilityPath}: collision status map must preserve every reviewed boundary treatment and the selected Bundle lifecycle`);
  }
  if (!deepEqual(compatibility?.ownership, expectedOwnership)) {
    errors.push(`${compatibilityPath}: product ownership boundaries must remain exact`);
  }
  if (
    !deepEqual(
      compatibility?.runtime_invariants?.map((entry) => entry?.statement),
      expectedRuntimeInvariantStatements,
    )
  ) {
    errors.push(`${compatibilityPath}: runtime invariant inventory must remain exact`);
  }

  const schemaDocuments = new Map();
  for (const relativePath of [...schemaPaths, ...acceptedRefPaths]) {
    const document = documents.get(relativePath);
    if (document) schemaDocuments.set(relativePath.split('/').at(-1), document);
  }
  const ids = new Set();
  for (const relativePath of schemaPaths) {
    const document = documents.get(relativePath);
    if (!document) continue;
    const schemaText = JSON.stringify(document);
    if (
      STALE_LIFECYCLE_PATTERN.test(schemaText)
      || UNAUTHORIZED_PROMOTION_CLAIM_PATTERN.test(schemaText)
    ) {
      errors.push(
        `${relativePath}: schema lifecycle wording or authority boundary is contradictory`,
      );
    }
    if (!document.$id || ids.has(document.$id)) {
      errors.push(`${relativePath}: missing or duplicate $id`);
    }
    ids.add(document.$id);
    for (const ref of collectRefs(document)) {
      const [fileName, fragment = ''] = ref.split('#');
      const target = fileName ? schemaDocuments.get(fileName) : document;
      if (!target || !jsonPointer(target, `#${fragment}`)) {
        errors.push(`${relativePath}: unresolved $ref ${ref}`);
      }
    }
  }
  const acceptedBundle = documents.get(
    'contracts/json-schema/cybrik.investigation-bundle.v1.schema.json',
  );
  const strictCompatibleBundlePath =
    'contracts/json-schema/cybrik.investigation-bundle.strict-compatible.v1.schema.json';
  const strictCompatibleBundle = documents.get(strictCompatibleBundlePath);
  if (acceptedBundle && strictCompatibleBundle) {
    const expectedStrictCompatibleBundle = JSON.parse(JSON.stringify(acceptedBundle));
    for (const metadataName of [
      '$id',
      'title',
      'description',
      'x-cybrik-status',
      'x-cybrik-not-accepted',
      'x-cybrik-contract-version',
    ]) {
      expectedStrictCompatibleBundle[metadataName] = strictCompatibleBundle[metadataName];
    }
    expectedStrictCompatibleBundle.properties.generated_by.allOf[1] = {
      type: 'object',
      required: ['tenant_id'],
      properties: {
        tenant_id: {
          $ref: 'cybrik.common-defs.v1.schema.json#/$defs/tenantId',
        },
      },
    };
    if (!deepEqual(strictCompatibleBundle, expectedStrictCompatibleBundle)) {
      errors.push(
        `${strictCompatibleBundlePath}: may differ from accepted v0.1.0 only by proposal metadata and the explicit generated_by strict-types annotation`,
      );
    }
  }

  const supersessionNote = supersession?.compatibility;
  if (
    typeof supersessionNote !== 'string'
    || supersessionRequiredPhrases.some((phrase) => !supersessionNote.includes(phrase))
    || inaccurateSuccessorPhrases.some((phrase) => supersessionNote.includes(phrase))
  ) {
    if (compatibility) {
      errors.push(
        `${compatibilityPath}: supersession compatibility note must scope the successor to Ajv's optional strict mode and must not claim the accepted v0.1.0 is repaired`,
      );
    }
  }
  const strictBundleDescription = strictCompatibleBundle?.description;
  if (strictCompatibleBundle && (
    typeof strictBundleDescription !== 'string'
    || strictBundleRequiredPhrases.some((phrase) => !strictBundleDescription.includes(phrase))
    || inaccurateSuccessorPhrases.some((phrase) => strictBundleDescription.includes(phrase))
  )) {
    errors.push(
      `${strictCompatibleBundlePath}: strict-compatible bundle description must scope the successor to Ajv's optional strict mode and must not claim a specification repair`,
    );
  }
  const bundleReadPath =
    'contracts/json-schema/cybrik.investigation-bundle-read-result.v1.schema.json';
  const bundleReadDescription = documents.get(bundleReadPath)?.description;
  if (
    typeof bundleReadDescription !== 'string'
    || [
      'ACCEPTED FOR IMPLEMENTATION strict-compatible v0.1.1',
      'authoritative for new bundle-read responses',
      'immutable supported legacy read/replay input',
      'Consumer migration remains separately gated by W1-REC-5',
      'NOT IMPLEMENTED, CI NOT WIRED',
    ].some((phrase) => !bundleReadDescription.includes(phrase))
    || STALE_LIFECYCLE_PATTERN.test(bundleReadDescription)
    || UNAUTHORIZED_PROMOTION_CLAIM_PATTERN.test(bundleReadDescription)
  ) {
    errors.push(`${bundleReadPath}: lifecycle description must select v0.1.1, preserve legacy v0.1.0 and keep migration/runtime gates closed`);
  }
  const transportBindingRule = supersession?.transport_binding_rule;
  if (
    typeof transportBindingRule !== 'string'
    || [
      'accepted strict-compatible v0.1.1',
      'authoritative validation profile for new responses/publications under W1-REC-3/4',
      'immutable supported legacy read/replay input',
      'consumer migration remains separately gated by W1-REC-5',
      'no product runtime, server, bus, Fabric, deployment, release',
    ].some((phrase) => !transportBindingRule.includes(phrase))
    || /\bPROPOSED\b|NOT ACCEPTED/.test(transportBindingRule)
  ) {
    errors.push(`${compatibilityPath}: transport binding rule must express the selected Bundle lifecycle without runtime or migration authority`);
  }
  const adoptionRule = supersession?.adoption_rule;
  if (
    typeof adoptionRule !== 'string'
    || [
      'W1-REC-3/4 accepts v0.1.1',
      'authoritative for new bundle-read responses',
      'immutable supported legacy read/replay input',
      'No automatic consumer migration is authorized',
      'consumer migration remains gated by W1-REC-5',
    ].some((phrase) => !adoptionRule.includes(phrase))
    || /\bPROPOSED\b|NOT ACCEPTED/.test(adoptionRule)
  ) {
    errors.push(`${compatibilityPath}: adoption rule must resolve W1-REC-3/4 and leave only W1-REC-5 migration pending`);
  }
  const openDecisions = compatibility?.open_decisions;
  if (
    !Array.isArray(openDecisions)
    || openDecisions.length !== 4
    || !deepEqual(
      openDecisions.map((entry) => entry?.id),
      ['OD-W1IL-1', 'OD-W1IL-2', 'OD-W1IL-3', 'OD-W1IL-4'],
    )
    || !openDecisions[0]?.question?.startsWith('HISTORICAL W1-C2 QUESTION')
    || [
      'W1-REC-3/4',
      'authoritative for new bundle-read responses',
      'immutable supported legacy read/replay input',
      'W1-REC-5',
    ].some((phrase) => !openDecisions[0]?.current?.includes(phrase))
    || openDecisions.slice(1).some(
      (entry) => typeof entry?.question !== 'string' || !entry?.current?.startsWith('OPEN —'),
    )
    || openDecisions.some(
      (entry) => /\bPROPOSED\b|NOT ACCEPTED/.test(`${entry?.question}\n${entry?.current}`),
    )
  ) {
    errors.push(`${compatibilityPath}: open-decision inventory must classify W1-C2 history and retain only real open gates`);
  }
  const acceptanceRecord = compatibility?.acceptance_record;
  if (
    !Array.isArray(acceptanceRecord)
    || acceptanceRecord.length !== 5
    || [
      ['W1-C2', 'W1-REC-3/4', 'authoritative for new bundle-read responses', 'immutable supported legacy read/replay input'],
      ['conformance evidence only'],
      ['byte-unchanged'],
      ['Cyber AI remains sole', 'Fabric execution authority is untouched'],
      ['consumer migration remain separately gated', 'W1-REC-3/4 grants no such authority'],
    ].some(
      (required, index) => required.some(
        (phrase) => !acceptanceRecord[index]?.includes(phrase),
      ),
    )
    || acceptanceRecord.some((entry) => /\bPROPOSED\b|NOT ACCEPTED/.test(entry))
  ) {
    errors.push(`${compatibilityPath}: acceptance record must preserve the complete W1-C2 and W1-REC-3/4 authority history`);
  }
  if (
    compatibility?.gate?.status !== GATE_STATUS
    || typeof compatibility?.gate?.decision !== 'string'
    || [
      'W1-C2 accepted',
      'W1-REC-3/4 subsequently accepted',
      'authoritative for new bundle-read responses',
      'immutable supported legacy read/replay input',
      'Consumer migration remains separately gated by W1-REC-5',
      'CI remains NOT WIRED',
      'no runtime',
      'Fabric authority',
      'stable v1/GA',
      'release authority',
    ].some((phrase) => !compatibility.gate.decision.includes(phrase))
    || /\bPROPOSED\b|NOT ACCEPTED/.test(compatibility.gate.decision)
  ) {
    errors.push(`${compatibilityPath}: gate status and decision must exactly express selected lifecycle and closed runtime/release authority`);
  }

  const forbiddenAuthorityFields = new Set([
    'capability',
    'capabilities',
    'delegation',
    'delegation_ref',
    'approval',
    'approval_id',
    'tool',
    'tools',
    'mcp',
    'action',
    'credential',
    'credentials',
  ]);
  for (const relativePath of schemaPaths) {
    const document = documents.get(relativePath);
    for (const propertyName of collectPropertyNames(document)) {
      if (forbiddenAuthorityFields.has(propertyName)) {
        errors.push(`${relativePath}: forbidden execution-authority field '${propertyName}'`);
      }
    }
  }
  const errorSchemaPath =
    'contracts/json-schema/cybrik.investigation-lifecycle-error.v1.schema.json';
  const errorSchema = documents.get(errorSchemaPath);
  const errorPropertyNames = new Set(collectPropertyNames(errorSchema));
  for (const name of [
    'resource_exists',
    'authorized',
    'authorization_reason',
    'owner_id',
    'tenant_id',
    'org_id',
    'policy_id',
  ]) {
    if (errorPropertyNames.has(name)) {
      errors.push(`${errorSchemaPath}: forbidden existence disclosure '${name}'`);
    }
  }
  const noExistenceLeakBranch = errorSchema?.allOf?.find(
    (branch) => branch?.if?.properties?.error_class?.const === 'not_found_or_not_authorized',
  );
  if (
    noExistenceLeakBranch?.then?.properties?.message_safe?.const
    !== 'The requested investigation is unavailable.'
  ) {
    errors.push(`${errorSchemaPath}: no-existence response requires one constant sanitized message`);
  }

  const fixtureCounts = {
    positive: 0,
    'negative-schema': 0,
    'negative-semantic': 0,
  };
  for (const fixture of examples?.examples || []) {
    const relativePath = `contracts/examples/investigation-lifecycle/${fixture.file}`;
    const data = documents.get(relativePath);
    const schema = schemaDocuments.get(fixture.schema);
    if (!data || !schema) {
      errors.push(`${fixture.file}: fixture or schema missing`);
      continue;
    }
    const shapeErrors = validateValue(schema, data, {
      schemas: schemaDocuments,
      currentDocument: schema,
    });
    if (!Object.hasOwn(fixtureCounts, fixture.kind)) {
      errors.push(`${fixture.file}: unknown fixture kind '${fixture.kind}'`);
      continue;
    }
    fixtureCounts[fixture.kind] += 1;
    if (fixture.kind === 'negative-schema' && shapeErrors.length === 0) {
      errors.push(`${fixture.file}: negative-schema fixture unexpectedly validates`);
    }
    if (fixture.kind !== 'negative-schema' && shapeErrors.length > 0) {
      errors.push(`${fixture.file}: fixture must be structurally valid: ${shapeErrors.join('; ')}`);
    }
  }
  const invariantFixtureMap = Object.fromEntries(
    Array.from({ length: 8 }, (_, index) => [`TR-${index + 1}`, []]),
  );
  for (const fixture of examples?.examples || []) {
    for (const invariantId of fixture.invariants || []) {
      if (!Object.hasOwn(invariantFixtureMap, invariantId)) {
        errors.push(`${fixture.file}: unknown fixture invariant id '${invariantId}'`);
        continue;
      }
      invariantFixtureMap[invariantId].push(fixture.file);
    }
  }
  for (const fixtureFiles of Object.values(invariantFixtureMap)) fixtureFiles.sort();
  const expectedInvariantFixtureMap = {
    'TR-1': [
      'negative-semantic/investigation-create-request.cross-tenant.json',
    ],
    'TR-2': [
      'negative-semantic/investigation-status.org-mismatch.json',
    ],
    'TR-3': [
      'negative-semantic/investigation-create-request.idempotency-conflict.json',
    ],
    'TR-4': [
      'negative-semantic/investigation-cancel-request.stale-version.json',
      'negative-semantic/investigation-cancel-request.terminal-race.json',
    ],
    'TR-5': [
      'negative-semantic/investigation-cancel-request.terminal-race.json',
      'negative-semantic/investigation-checkpoint.retry-mutates-terminal-attempt.json',
    ],
    'TR-6': [
      'negative-semantic/investigation-checkpoint.retry-mutates-terminal-attempt.json',
    ],
    'TR-7': [
      'negative-semantic/investigation-bundle-read-result.marking-downgrade.json',
    ],
    'TR-8': [
      'negative-schema/investigation-lifecycle-error.existence-leak.json',
      'positive/investigation-lifecycle-error.not-found.json',
    ],
  };
  if (!deepEqual(invariantFixtureMap, expectedInvariantFixtureMap)) {
    errors.push('fixture-to-runtime-invariant mapping must match the exact reviewed evidence map');
  }

  const positiveStatus = documents.get(
    'contracts/examples/investigation-lifecycle/positive/investigation-status.cancelled.json',
  );
  const staleCancel = documents.get(
    'contracts/examples/investigation-lifecycle/negative-semantic/investigation-cancel-request.stale-version.json',
  );
  const terminalCancel = documents.get(
    'contracts/examples/investigation-lifecycle/negative-semantic/investigation-cancel-request.terminal-race.json',
  );
  const retryCheckpoint = documents.get(
    'contracts/examples/investigation-lifecycle/negative-semantic/investigation-checkpoint.retry-mutates-terminal-attempt.json',
  );
  const crossTenant = documents.get(
    'contracts/examples/investigation-lifecycle/negative-semantic/investigation-create-request.cross-tenant.json',
  );
  const positiveCreate = documents.get(
    'contracts/examples/investigation-lifecycle/positive/investigation-create-request.json',
  );
  const idempotencyConflict = documents.get(
    'contracts/examples/investigation-lifecycle/negative-semantic/investigation-create-request.idempotency-conflict.json',
  );
  const downgrade = documents.get(
    'contracts/examples/investigation-lifecycle/negative-semantic/investigation-bundle-read-result.marking-downgrade.json',
  );
  const positiveNoExistenceLeak = documents.get(
    'contracts/examples/investigation-lifecycle/positive/investigation-lifecycle-error.not-found.json',
  );
  const negativeExistenceLeak = documents.get(
    'contracts/examples/investigation-lifecycle/negative-schema/investigation-lifecycle-error.existence-leak.json',
  );
  if (crossTenant?.tenant_id === crossTenant?.actor?.tenant_id) {
    errors.push('TR-1 fixture must embody a body/actor tenant mismatch');
  }
  if (
    idempotencyConflict?.idempotency_key !== positiveCreate?.idempotency_key
    || idempotencyConflict?.actor?.id !== positiveCreate?.actor?.id
    || deepEqual(idempotencyConflict, positiveCreate)
  ) {
    errors.push('TR-3 fixture must reuse principal/key with different normalized content');
  }
  if (!(staleCancel?.expected_version < positiveStatus?.version)) {
    errors.push('TR-4 stale-cancel fixture must be older than authoritative status');
  }
  if (
    terminalCancel?.expected_version !== positiveStatus?.version
    || !['completed', 'partial', 'abstained', 'denied', 'cancelled', 'failed']
      .includes(positiveStatus?.run_status)
  ) {
    errors.push('TR-4/TR-5 terminal-race fixture must target the current terminal version');
  }
  if (
    retryCheckpoint?.attempt_id !== retryCheckpoint?.previous_attempt_id
    || retryCheckpoint?.sequence === 1
  ) {
    errors.push('TR-5/TR-6 retry fixture must embody self-link plus non-reset sequence');
  }
  const classificationRank = new Map([
    ['public', 0],
    ['internal', 1],
    ['confidential', 2],
    ['restricted', 3],
  ]);
  const tlpRank = new Map([
    ['TLP:CLEAR', 0],
    ['TLP:GREEN', 1],
    ['TLP:AMBER', 2],
    ['TLP:AMBER+STRICT', 3],
    ['TLP:RED', 4],
  ]);
  if (
    classificationRank.get(downgrade?.data_marking?.classification)
      >= classificationRank.get(downgrade?.bundle?.data_marking?.classification)
    || tlpRank.get(downgrade?.data_marking?.tlp)
      >= tlpRank.get(downgrade?.bundle?.data_marking?.tlp)
  ) {
    errors.push('TR-7 fixture must embody a bundle wrapper marking downgrade');
  }
  const expectedNoExistenceLeakMessage = 'The requested investigation is unavailable.';
  if (
    positiveNoExistenceLeak?.error_class !== 'not_found_or_not_authorized'
    || positiveNoExistenceLeak?.message_safe !== expectedNoExistenceLeakMessage
    || positiveNoExistenceLeak?.retryable !== false
  ) {
    errors.push('TR-8 positive fixture must use the constant sanitized no-existence response');
  }
  const positiveNoExistenceKeys = Object.keys(positiveNoExistenceLeak || {}).sort();
  if (!deepEqual(positiveNoExistenceKeys, [
    'error_class',
    'message_safe',
    'request_id',
    'retryable',
  ])) {
    errors.push('TR-8 positive fixture must carry no target, tenant, org, owner, or policy identifiers');
  }
  const negativeLeakKeys = Object.keys(negativeExistenceLeak || {}).sort();
  if (
    negativeExistenceLeak?.error_class !== 'not_found_or_not_authorized'
    || negativeExistenceLeak?.message_safe !== expectedNoExistenceLeakMessage
    || negativeExistenceLeak?.retryable !== false
    || negativeExistenceLeak?.resource_exists !== true
    || !deepEqual(negativeLeakKeys, [
      'error_class',
      'message_safe',
      'request_id',
      'resource_exists',
      'retryable',
    ])
  ) {
    errors.push('TR-8 negative fixture must be the exact resource-existence disclosure decoy');
  }

  const semanticInvariantIds = (compatibility?.runtime_invariants || []).map((entry) => entry.id);
  const expectedInvariantIds = Array.from({ length: 8 }, (_, index) => `TR-${index + 1}`);
  if (!deepEqual(semanticInvariantIds, expectedInvariantIds)) {
    errors.push('runtime invariant inventory must be exactly TR-1..TR-8');
  }

  return {
    status: compatibility?.['x-cybrik-status'],
    notAccepted: compatibility?.['x-cybrik-not-accepted'],
    packetVersion: compatibility?.['x-cybrik-packet-version'],
    errors,
    semanticInvariantIds,
    invariantFixtureMap,
    counts: {
      packetFiles: expectedPacketPaths.filter((relativePath) => texts.has(relativePath)).length,
      positiveFixtures: fixtureCounts.positive,
      negativeSchemaFixtures: fixtureCounts['negative-schema'],
      negativeSemanticFixtures: fixtureCounts['negative-semantic'],
      runtimeInvariants: semanticInvariantIds.length,
      events: eventNames.length,
      operations: operationIds.length,
    },
  };
}

async function main() {
  const report = await validateInvestigationLifecycleProposal();
  if (report.errors.length > 0) {
    for (const error of report.errors) console.error(`FAIL: ${error}`);
    console.error(`RESULT=RED errors=${report.errors.length}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    [
      'RESULT=PASS',
      `status=${report.status}`,
      `not_accepted=${report.notAccepted}`,
      `packet_files=${report.counts.packetFiles}`,
      `positive=${report.counts.positiveFixtures}`,
      `negative_schema=${report.counts.negativeSchemaFixtures}`,
      `negative_semantic=${report.counts.negativeSemanticFixtures}`,
      `runtime_invariants=${report.counts.runtimeInvariants}`,
      `operations=${report.counts.operations}`,
      `events=${report.counts.events}`,
    ].join(' '),
  );
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await main();
}
