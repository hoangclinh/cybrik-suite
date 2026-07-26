// Standalone test suite for the W1 R0 `soc.get_alert_context` packet validator,
// which is ACCEPTED FOR IMPLEMENTATION as of 2026-07-26 and NOT IMPLEMENTED.
//
// The suite holds exactly 19 adversarial rejection cases plus 2 positive checks.
// Several adversarial cases are table-driven over multiple mutations; every
// mutation must be rejected. `POSITIVE_CASES[0]` asserts that the compatibility
// manifest's declared `verification.test_case_counts` still equals the real
// case-array lengths, so the declared wording cannot drift from the suite.
//
// Passing proves static packet integrity only. The lifecycle acceptance it
// checks is a contract decision, not evidence: no endpoint is implemented, no
// Fabric tool invocation is authorized, and no runtime authorization or
// no-existence-leak behavior is proven.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import {
  canonicalizeJcs,
  validateAlertContextPacket,
} from '../validate-alert-context.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');
const SOURCE_CONTRACTS = join(REPO_ROOT, 'contracts');
const DEPENDENCY_ROOT = process.env.CYBRIK_CONTRACT_VALIDATION_DEPS_ROOT
  || resolve(REPO_ROOT, 'tools/contract-validation');
const COMPATIBILITY = 'compatibility/cybrik-suite-alert-context-packet.v1.manifest.json';
const SCHEMA = 'json-schema/cybrik.soc-get-alert-context.v1.schema.json';
const EXAMPLES_MANIFEST = 'examples/alert-context/examples-manifest.json';
const REQUEST = 'examples/alert-context/positive/request.json';
const AVAILABLE = 'examples/alert-context/positive/result.available.json';
const UNAVAILABLE = 'examples/alert-context/positive/result.unavailable.json';
const CROSS_TENANT = 'examples/alert-context/negative-semantic/request.cross-tenant-actor.json';
const CROSS_ORG = 'examples/alert-context/negative-semantic/result.cross-org.json';
const CLEARANCE = 'examples/alert-context/negative-semantic/result.clearance-exceeded.json';
const DIGEST_MISMATCH = 'examples/alert-context/negative-semantic/result.digest-mismatch.json';
const EXECUTION_GRANT =
  'examples/alert-context/negative-schema/request.execution-grant-in-body.json';
const MISSING_DIGEST =
  'examples/alert-context/negative-schema/request.alert-ref-missing-digest.json';
const ALERT_DIGEST = `sha256:${'3'.repeat(64)}`;

// The exact pre-acceptance schema bytes digest. Any binding still pinning it
// after the lifecycle flip is a stale binding and must fail closed.
const SUPERSEDED_SCHEMA_DIGEST =
  'sha256:a5c5c471bdd70b6bc46c18628171ca5a696f2a207b3850c06256d816aabb0f4b';
const ACCEPTED_STATUS_TOKEN = 'ACCEPTED_FOR_IMPLEMENTATION_NOT_ACCEPTED_FLAG=false';

// Independent expectation of which canonical structural trust invariant each
// negative-schema fixture witnesses. The compatibility manifest owns the label
// text; the examples manifest may only cite a label that exists there.
const EXPECTED_TRUST_INVARIANTS = {
  'negative-schema/request.execution-grant-in-body.json': 'TI-3',
  'negative-schema/request.w2f-delegation-as-tool-grant.json': 'TI-3',
  'negative-schema/request.alert-ref-missing-digest.json': 'TI-5',
  'negative-schema/result.existence-leak.json': 'TI-4',
};

const relabelExample = (manifest, file, from, to) => {
  const row = manifest.examples.find((entry) => entry.file === file);
  row.invariant = row.invariant.replace(new RegExp(`^${from} `), `${to} `);
};

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const jcsDigest = (value) =>
  `sha256:${sha256(Buffer.from(canonicalizeJcs(value), 'utf8'))}`;
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

// Independent re-implementation of the declared non-circular member-set
// algorithm: reduce each member row to its four allowlisted fields, sort by
// file, and digest the RFC 8785/JCS bytes of that array only. No other manifest
// key — including the block that carries the result — is an input.
const memberSetDigest = (members) => jcsDigest(
  (members || [])
    .map((member) => ({
      file: member.file,
      kind: member.kind,
      contract_version: member.contract_version,
      sha256: member.sha256,
    }))
    .sort((left, right) => {
      if (left.file < right.file) return -1;
      return left.file > right.file ? 1 : 0;
    }),
);

const withPacketCopy = (run) => {
  const root = mkdtempSync(join(tmpdir(), 'cybrik-alert-context-'));
  const contracts = join(root, 'contracts');
  cpSync(join(SOURCE_CONTRACTS, 'json-schema'), join(contracts, 'json-schema'), {
    recursive: true,
  });
  cpSync(
    join(SOURCE_CONTRACTS, 'examples/alert-context'),
    join(contracts, 'examples/alert-context'),
    { recursive: true },
  );
  cpSync(
    join(SOURCE_CONTRACTS, COMPATIBILITY),
    join(contracts, COMPATIBILITY),
    { recursive: true },
  );
  try {
    return run(contracts);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const refreshAggregate = (contracts) => {
  const manifestPath = join(contracts, COMPATIBILITY);
  const manifest = readJson(manifestPath);
  if (!manifest.member_set_integrity) return;
  manifest.member_set_integrity.member_set_digest = memberSetDigest(manifest.members);
  writeJson(manifestPath, manifest);
};

const mutateJson = (
  contracts,
  relativePath,
  mutate,
  { rehash = true, rehashAggregate = true } = {},
) => {
  const path = join(contracts, relativePath);
  const value = readJson(path);
  mutate(value);
  writeJson(path, value);
  if (relativePath === COMPATIBILITY) return;
  const manifestPath = join(contracts, COMPATIBILITY);
  const manifest = readJson(manifestPath);
  if (rehash) {
    const member = manifest.members.find((candidate) => candidate.file === relativePath);
    if (member) member.sha256 = sha256(readFileSync(path));
  }
  if (manifest.member_set_integrity && rehashAggregate) {
    manifest.member_set_integrity.member_set_digest = memberSetDigest(manifest.members);
  }
  writeJson(manifestPath, manifest);
};

const validate = (contracts, dependencyRoot = DEPENDENCY_ROOT) => validateAlertContextPacket({
  contractsRoot: contracts,
  dependencyRoot,
});

const expectFailure = (result, pattern) => {
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), pattern);
};

// Each table row mutates one packet file inside a throwaway copy and asserts the
// validator fails closed with the expected message.
const expectRejected = ({ file, mutate, pattern, options, after }) => {
  withPacketCopy((contracts) => {
    mutateJson(contracts, file, mutate, options);
    if (after) after(contracts);
    expectFailure(validate(contracts), pattern);
  });
};

const runTable = (rows) => { for (const row of rows) expectRejected(row); };

const refreshContextDigest = (result) => {
  result.context_digest = jcsDigest({
    schema: 'cybrik.soc-get-alert-context.available-result@0.1.0',
    request_id: result.request_id,
    idempotency_key: result.idempotency_key,
    authorization_binding_digest: result.authorization_binding.binding_digest,
    tenant_id: result.tenant_id,
    org_scope: result.org_scope,
    authorized_actor: result.authorized_actor,
    clearance: result.clearance,
    capability: result.capability,
    alert_ref: result.alert_ref,
    context: result.context,
    data_marking: result.data_marking,
    policy_digest: result.policy_digest,
  });
};

const refreshPositiveBindingAcrossPacket = (contracts) => {
  const schemaPath = join(contracts, SCHEMA);
  const requestPath = join(contracts, REQUEST);
  const request = readJson(requestPath);
  request.authorization_binding.tenant_id = request.tenant_id;
  request.authorization_binding.org_scope = structuredClone(request.org_scope);
  request.authorization_binding.actor = structuredClone(request.actor);
  request.authorization_binding.capability = structuredClone(request.capability);
  request.authorization_binding.schema_digest = `sha256:${sha256(readFileSync(schemaPath))}`;
  request.authorization_binding.input_digest = jcsDigest({
    schema: 'cybrik.soc-get-alert-context.request-input@0.1.0',
    idempotency_key: request.idempotency_key,
    purpose: request.purpose,
    data_marking: request.data_marking,
    alert_ref: request.alert_ref,
    requested_at: request.requested_at,
  });
  request.authorization_binding.policy_digest = request.policy_digest;
  request.authorization_binding.binding_digest = jcsDigest({
    schema: 'cybrik.soc-get-alert-context.authorization-binding@0.1.0',
    tenant_id: request.authorization_binding.tenant_id,
    org_scope: request.authorization_binding.org_scope,
    actor: request.authorization_binding.actor,
    capability: request.authorization_binding.capability,
    schema_digest: request.authorization_binding.schema_digest,
    input_digest: request.authorization_binding.input_digest,
    policy_digest: request.authorization_binding.policy_digest,
  });
  writeJson(requestPath, request);
  for (const relativePath of [AVAILABLE, UNAVAILABLE]) {
    const path = join(contracts, relativePath);
    const result = readJson(path);
    result.authorized_actor = structuredClone(request.actor);
    result.authorization_binding = structuredClone(request.authorization_binding);
    if (result.outcome === 'available') refreshContextDigest(result);
    writeJson(path, result);
  }
  const manifestPath = join(contracts, COMPATIBILITY);
  const manifest = readJson(manifestPath);
  for (const relativePath of [SCHEMA, REQUEST, AVAILABLE, UNAVAILABLE]) {
    const member = manifest.members.find((candidate) => candidate.file === relativePath);
    member.sha256 = sha256(readFileSync(join(contracts, relativePath)));
  }
  writeJson(manifestPath, manifest);
  refreshAggregate(contracts);
};

// Schema weakenings are additionally re-signed end to end, so each row proves the
// structural allowlist rejects the change on its own merits.
const expectSchemaRejected = (mutate, pattern) => expectRejected({
  file: SCHEMA,
  mutate,
  pattern,
  after: refreshPositiveBindingAcrossPacket,
});

// ---------------------------------------------------------------------------
// 19 adversarial rejection cases
// ---------------------------------------------------------------------------

const REJECTION_CASES = [
  ['rejects request identity and authorization-binding digest drift', () => runTable([
    {
      file: REQUEST,
      mutate: (request) => {
        request.actor.type = 'service';
        request.actor.id = 'spiffe://cybrik.example/other';
      },
      pattern: /authorization binding.*actor/i,
    },
    {
      file: REQUEST,
      mutate: (request) => {
        request.authorization_binding.schema_digest = `sha256:${'a'.repeat(64)}`;
      },
      pattern: /schema_digest must pin exact schema bytes/i,
    },
    {
      file: REQUEST,
      mutate: (request) => {
        request.authorization_binding.input_digest = `sha256:${'b'.repeat(64)}`;
      },
      pattern: /input_digest must match its own RFC 8785 request-input projection/i,
    },
    {
      file: REQUEST,
      mutate: (request) => {
        request.authorization_binding.binding_digest = `sha256:${'c'.repeat(64)}`;
      },
      pattern: /binding_digest must match the RFC 8785 authorization-binding projection/i,
    },
    {
      file: REQUEST,
      mutate: (request) => {
        request.authorization_binding.actor.tenant_id = 'tenant-other';
      },
      pattern: /binding actor tenant must equal binding authoritative tenant/i,
    },
  ])],

  ['rejects cross-tenant actor even when every actor copy and digest drifts together', () => {
    withPacketCopy((contracts) => {
      mutateJson(contracts, REQUEST, (request) => {
        request.actor.tenant_id = 'tenant-other';
      });
      refreshPositiveBindingAcrossPacket(contracts);
      expectFailure(validate(contracts), /actor tenant.*authoritative tenant/i);
    });
  }],

  ['rejects result hierarchy expansion including include_descendants drift', () => runTable([
    {
      file: AVAILABLE,
      mutate: (result) => { result.org_scope.include_descendants = true; },
      pattern: /preserve.*org scope/i,
    },
    {
      file: AVAILABLE,
      mutate: (result) => { result.org_scope.org_id = 'org-soc-west'; },
      pattern: /preserve.*org scope/i,
    },
  ])],

  ['rejects unavailable-result actor and binding tenant correlation drift', () => runTable([
    {
      file: UNAVAILABLE,
      mutate: (result) => { result.authorized_actor.id = 'membership-other'; },
      pattern: /unavailable.*full actor identity/i,
    },
    {
      file: UNAVAILABLE,
      mutate: (result) => { result.authorized_actor.tenant_id = 'tenant-other'; },
      pattern: /authorized actor tenant must equal result authoritative tenant/i,
    },
    {
      file: UNAVAILABLE,
      mutate: (result) => {
        result.authorization_binding.tenant_id = 'tenant-other';
        result.authorization_binding.actor.tenant_id = 'tenant-other';
      },
      pattern: /authorization binding tenant must equal result authoritative tenant/i,
    },
  ])],

  ['rejects arbitrary locator injection on closed internal object references', () => runTable([
    {
      file: AVAILABLE,
      mutate: (result) => {
        result.context.event_refs[0].locator = 'https://169.254.169.254/latest/meta-data';
      },
      pattern: /positive fixture failed schema validation/i,
    },
    {
      file: AVAILABLE,
      mutate: (result) => {
        result.context.entity_refs[0].locator = 'file:///etc/passwd';
      },
      pattern: /positive fixture failed schema validation/i,
    },
  ])],

  ['rejects schema-surface weakening even after every dependent digest is refreshed', () => {
    expectSchemaRejected(
      (schema) => { schema.$defs.alertContext.properties.inline_payload = { type: 'string' }; },
      /alertContext properties.*(?:unexpected key|exact allowlist)/i,
    );
    expectSchemaRejected(
      (schema) => { schema.extra_surface = { type: 'string' }; },
      /schema top level.*unexpected key 'extra_surface'/i,
    );
    expectSchemaRejected(
      (schema) => {
        schema.$defs.request.required = schema.$defs.request.required
          .filter((key) => key !== 'purpose');
      },
      /request required set must match/i,
    );
    expectSchemaRejected(
      (schema) => {
        schema.$defs.result.required = schema.$defs.result.required
          .filter((key) => key !== 'policy_digest');
      },
      /result required set must match/i,
    );
    expectSchemaRejected(
      (schema) => {
        schema.$defs.orgScope.required = schema.$defs.orgScope.required
          .filter((key) => key !== 'include_descendants');
      },
      /orgScope required set must match/i,
    );
    expectSchemaRejected(
      (schema) => { schema.$defs.safeInternalObjectRef.additionalProperties = true; },
      /safeInternalObjectRef: additionalProperties must be false/i,
    );
    expectSchemaRejected(
      (schema) => {
        schema.$defs.safeInternalObjectRef.properties.locator = { type: 'string' };
      },
      /must forbid locator/i,
    );
    expectSchemaRejected(
      (schema) => {
        schema.$defs.alertContext.properties.event_refs.items = { type: 'object' };
      },
      /alertContext.event_refs must use safeInternalObjectRef/i,
    );
    expectSchemaRejected(
      (schema) => { schema.$defs.alertRef.allOf[0] = { type: 'object' }; },
      /alertRef must use safeInternalObjectRef/i,
    );
    expectSchemaRejected(
      (schema) => { schema.$defs.alertRef.allOf.push({ title: 'extra branch' }); },
      /alertRef allOf must contain exactly/i,
    );
    expectSchemaRejected(
      (schema) => { schema.$defs.capabilityPin.properties.risk_class = { const: 'R1' }; },
      /capability pin must be exact/i,
    );
    expectSchemaRejected(
      (schema) => {
        schema.$defs.unavailableFailure.properties.code = { const: 'alert_missing' };
      },
      /only alert_context_unavailable/i,
    );
    expectSchemaRejected(
      (schema) => {
        schema.$defs.idempotencyConflictFailure.properties.code = { const: 'other_conflict' };
      },
      /only idempotency_binding_conflict/i,
    );
  }],

  ['rejects lifecycle regression and derives the printed status from invalid fields', () => {
    withPacketCopy((contracts) => {
      mutateJson(contracts, COMPATIBILITY, (manifest) => {
        manifest['x-cybrik-status'] = 'PROPOSED';
        manifest['x-cybrik-not-accepted'] = true;
        manifest.acceptance.status = 'PROPOSED';
      });
      const result = validate(contracts);
      expectFailure(result, /must stay 'ACCEPTED FOR IMPLEMENTATION'/i);
      assert.notEqual(result.status, ACCEPTED_STATUS_TOKEN);
    });
    runTable([
      {
        file: SCHEMA,
        mutate: (schema) => { schema['x-cybrik-status'] = 'ACCEPTED'; },
        pattern: /must stay 'ACCEPTED FOR IMPLEMENTATION'/i,
      },
      {
        file: EXAMPLES_MANIFEST,
        mutate: (manifest) => { manifest['x-cybrik-not-accepted'] = true; },
        pattern: /x-cybrik-not-accepted must stay false/i,
      },
      {
        file: EXAMPLES_MANIFEST,
        mutate: (manifest) => { manifest['x-cybrik-contract-version'] = '0.2.0'; },
        pattern: /x-cybrik-contract-version must be 0\.1\.0/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => { manifest['x-cybrik-packet-version'] = '1.0.0'; },
        pattern: /mutable pre-GA packet/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => { manifest['x-cybrik-is-bundle-tag'] = true; },
        pattern: /mutable pre-GA packet/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => {
          manifest.capability_scope.implementation_status = 'IMPLEMENTED';
        },
        pattern: /implementation_status must stay NOT IMPLEMENTED/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => { manifest.acceptance.status = 'ACCEPTED'; },
        pattern: /acceptance\.status must equal the declared x-cybrik-status/i,
      },
    ]);
  }],

  ['rejects lifecycle half-flips across status, acceptance and proof fields', () => runTable([
    {
      // Headers flipped but the acceptance record left behind.
      file: COMPATIBILITY,
      mutate: (manifest) => { manifest.acceptance.status = 'PROPOSED — NOT ACCEPTED'; },
      pattern: /acceptance\.status must equal the declared x-cybrik-status/i,
    },
    {
      // Lifecycle accepted but the proof ledger still denies it.
      file: COMPATIBILITY,
      mutate: (manifest) => { manifest.proof_limits.accepted_for_implementation = false; },
      pattern: /accepted_for_implementation must be true/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => { manifest.acceptance.accepted_on = '2026-01-01'; },
      pattern: /acceptance\.accepted_on must be 2026-07-26/i,
    },
    {
      // Only the schema is left un-flipped: the documents no longer agree.
      file: SCHEMA,
      mutate: (schema) => {
        schema['x-cybrik-status'] = 'PROPOSED';
        schema['x-cybrik-not-accepted'] = true;
      },
      pattern: /lifecycle half-flip: schema, examples manifest and compatibility manifest/i,
    },
    {
      // Superseded lifecycle prose surviving inside an otherwise flipped document.
      file: EXAMPLES_MANIFEST,
      mutate: (manifest) => {
        manifest.description = `${manifest.description} Status: PROPOSED — NOT ACCEPTED.`;
      },
      pattern: /superseded PROPOSED lifecycle text must not survive/i,
    },
    {
      file: SCHEMA,
      mutate: (schema) => {
        schema.description = `${schema.description} Status: PROPOSED — NOT ACCEPTED.`;
      },
      pattern: /superseded PROPOSED lifecycle text must not survive/i,
    },
  ])],

  ['rejects authorization bindings left stale after the schema and lifecycle flip', () => runTable([
    {
      file: REQUEST,
      mutate: (request) => {
        request.authorization_binding.schema_digest = SUPERSEDED_SCHEMA_DIGEST;
      },
      pattern: /schema_digest must pin exact schema bytes/i,
    },
    {
      // A negative-semantic witness may not silently keep a superseded pin.
      file: CROSS_ORG,
      mutate: (result) => {
        result.authorization_binding.schema_digest = SUPERSEDED_SCHEMA_DIGEST;
      },
      pattern: /schema_digest must pin exact schema bytes/i,
    },
    {
      // Neither may a structurally rejected negative-schema fixture.
      file: EXECUTION_GRANT,
      mutate: (request) => {
        request.authorization_binding.schema_digest = SUPERSEDED_SCHEMA_DIGEST;
      },
      pattern: /schema_digest must pin exact schema bytes/i,
    },
    {
      file: CLEARANCE,
      mutate: (result) => {
        result.authorization_binding.binding_digest = `sha256:${'d'.repeat(64)}`;
      },
      pattern: /binding_digest must match the RFC 8785 authorization-binding projection/i,
    },
    {
      // Rebinding the request input without recomputing input_digest is stale.
      file: MISSING_DIGEST,
      mutate: (request) => { request.idempotency_key = 'idem-alert-context-rebound-0001'; },
      pattern: /input_digest must match its own RFC 8785 request-input projection/i,
    },
  ])],

  ['rejects closing or dropping the declared open runtime obligations', () => runTable([
    {
      file: COMPATIBILITY,
      mutate: (manifest) => {
        manifest.acceptance.open_runtime_obligations = ['TR-7', 'TR-8'];
      },
      pattern: /open_runtime_obligations must be exactly TR-7, TR-8, TR-9/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => {
        manifest.trust_invariants.runtime_only_declared = manifest.trust_invariants
          .runtime_only_declared.filter((entry) => !entry.startsWith('TR-9 '));
      },
      pattern: /runtime_only_declared must declare exactly TR-7, TR-8, TR-9/i,
    },
    {
      // Acceptance must not be used to reclassify an open runtime obligation as
      // already exercised by a static fixture.
      file: COMPATIBILITY,
      mutate: (manifest) => {
        const moved = manifest.trust_invariants.runtime_only_declared
          .find((entry) => entry.startsWith('TR-7 '));
        manifest.trust_invariants.runtime_only_declared = manifest.trust_invariants
          .runtime_only_declared.filter((entry) => entry !== moved);
        manifest.trust_invariants.runtime_only_fixture_exercised.push(moved);
      },
      pattern: /TR-7 must stay an open runtime obligation/i,
    },
  ])],

  ['rejects manifest claim, verification-command and member-set-algorithm drift', () => {
    withPacketCopy((contracts) => {
      mutateJson(contracts, COMPATIBILITY, (manifest) => {
        manifest.runtime_verified = true;
        manifest.proof_limits.runtime_authorization_proven = true;
      });
      const result = validate(contracts);
      expectFailure(result, /unexpected key|runtime_authorization_proven must stay false/i);
      assert.equal(result.runtimeAuthorizationProven, true);
    });
    runTable([
      {
        file: COMPATIBILITY,
        mutate: (manifest) => { manifest.proof_limits.release_ready = true; },
        pattern: /proof_limits\.release_ready must stay false/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => {
          manifest.proof_limits.static_packet_integrity_proven = false;
        },
        pattern: /static_packet_integrity_proven must be true/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => { manifest.format_pins = '2020-12'; },
        pattern: /format_pins: must be an object/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => {
          manifest.authority_boundaries.fabric = 'Fabric may grant this capability.';
        },
        pattern: /authority boundary must include/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => {
          manifest.verification.standalone_validator_command = 'npm run validate';
        },
        pattern: /verification\.standalone_validator_command must match/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => {
          manifest.verification.standalone_test_command = 'npm test';
        },
        pattern: /verification\.standalone_test_command must match/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => {
          manifest.verification.standalone_coverage_command = 'node --test';
        },
        pattern: /verification\.standalone_coverage_command must match/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => {
          manifest.verification.dependency_root_override_env = 'PATH';
        },
        pattern: /verification\.dependency_root_override_env must match/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => { manifest.verification.coverage_floor = 'best effort'; },
        pattern: /verification\.coverage_floor must match/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => {
          manifest.verification.ci_wiring = 'Wired and green in the canonical CI pipeline.';
        },
        pattern: /verification\.ci_wiring must match/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => { manifest.verification.scope = 'Proves runtime behavior.'; },
        pattern: /verification\.scope must match/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => {
          manifest.verification.test_case_counts.adversarial_rejection_cases = 12;
        },
        pattern: /verification\.test_case_counts must match/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => {
          manifest.member_set_integrity.algorithm = 'SHA-256 over the whole manifest bytes.';
        },
        pattern: /member_set_integrity\.algorithm must match/i,
      },
    ]);
  }],

  ['rejects weakened authorization-before-cache order and canonicalization drift', () => runTable([
    {
      file: COMPATIBILITY,
      mutate: (manifest) => {
        manifest.idempotency_semantics.order = 'Cache lookup first, authorize later.';
        manifest.canonicalization.request_input_projection.pop();
      },
      pattern: /Authorization-before-cache|request_input_projection/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => {
        manifest.idempotency_semantics.unavailable_derivation =
          'Unavailable responses may reflect whether the target exists.';
      },
      pattern: /idempotency semantics must include/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => {
        manifest.canonicalization.standard = 'Bespoke key-sorted JSON, SHA-1.';
      },
      pattern: /canonicalization must pin RFC 8785/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => {
        manifest.canonicalization.owner = 'Fabric produces every projection digest.';
      },
      pattern: /canonicalization must pin RFC 8785/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => {
        manifest.canonicalization.available_result_projection.push('cache_key');
      },
      pattern: /available_result_projection must match/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => {
        manifest.canonicalization.authorization_binding_projection[1] = 'tenant_id = body-supplied';
      },
      pattern: /authorization_binding_projection must match/i,
    },
  ])],

  ['rejects orphan and symlinked entries in the fixture filesystem inventory', () => {
    withPacketCopy((contracts) => {
      writeJson(join(contracts, 'examples/alert-context/orphan.json'), {
        status: 'must-not-be-ignored',
      });
      expectFailure(validate(contracts), /filesystem inventory.*orphan/i);
    });
    withPacketCopy((contracts) => {
      symlinkSync(
        join(contracts, AVAILABLE),
        join(contracts, 'examples/alert-context/positive/result.link.json'),
      );
      expectFailure(validate(contracts), /orphan=SYMLINK:/);
    });
  }],

  ['rejects manifest row, trust-invariant traceability, allowlist and stale-aggregate tampering', () => {
    withPacketCopy((contracts) => {
      mutateJson(contracts, EXAMPLES_MANIFEST, (manifest) => {
        manifest.examples.push({ ...manifest.examples[0] });
      });
      mutateJson(contracts, COMPATIBILITY, (manifest) => {
        manifest.members.push({ ...manifest.members[0] });
      });
      expectFailure(validate(contracts), /duplicate example|duplicate compatibility member/i);
    });
    runTable([
      {
        file: EXAMPLES_MANIFEST,
        mutate: (manifest) => { manifest.examples[0].kind = 'negative-schema'; },
        pattern: /outside exact filename\/kind allowlist/i,
      },
      {
        file: EXAMPLES_MANIFEST,
        mutate: (manifest) => { manifest.examples[0].file = 'positive/request.renamed.json'; },
        pattern: /outside exact filename\/kind allowlist/i,
      },
      {
        file: EXAMPLES_MANIFEST,
        mutate: (manifest) => {
          relabelExample(
            manifest,
            'negative-schema/request.execution-grant-in-body.json',
            'TI-3',
            'TI-1',
          );
        },
        pattern: /expected trust invariant must be TI-3, got TI-1/i,
      },
      {
        file: EXAMPLES_MANIFEST,
        mutate: (manifest) => {
          relabelExample(
            manifest,
            'negative-schema/request.w2f-delegation-as-tool-grant.json',
            'TI-3',
            'TI-2',
          );
        },
        pattern: /expected trust invariant must be TI-3, got TI-2/i,
      },
      {
        file: EXAMPLES_MANIFEST,
        mutate: (manifest) => {
          relabelExample(
            manifest,
            'negative-schema/request.alert-ref-missing-digest.json',
            'TI-5',
            'TI-3',
          );
        },
        pattern: /expected trust invariant must be TI-5, got TI-3/i,
      },
      {
        file: EXAMPLES_MANIFEST,
        mutate: (manifest) => {
          const row = manifest.examples
            .find((entry) => entry.file === 'negative-schema/result.existence-leak.json');
          row.invariant = row.invariant.replace(/^TI-4 /, '');
        },
        pattern: /invariant must start with a canonical TI-<n> label/i,
      },
      {
        // The examples manifest may only cite labels the compatibility manifest
        // still declares; renumbering the canonical entry breaks the trace.
        file: COMPATIBILITY,
        mutate: (manifest) => {
          manifest.trust_invariants.structural = manifest.trust_invariants.structural
            .map((entry) => entry.replace(/^TI-5 /, 'TI-9 '));
        },
        pattern: /TI-5 is absent from compatibility trust_invariants\.structural/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => { manifest.members[0].kind = 'example-manifest'; },
        pattern: /outside exact file\/kind\/version allowlist/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => { manifest.members[0].contract_version = '0.2.0'; },
        pattern: /outside exact file\/kind\/version allowlist/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => { manifest.members[0].sha256 = 'f'.repeat(64); },
        pattern: /sha256 must be/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => { manifest.member_set_integrity.member_count = 12; },
        pattern: /member_count must be 13/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => {
          manifest.member_set_integrity.member_set_digest = `sha256:${'e'.repeat(64)}`;
        },
        pattern: /member_set_digest must be/i,
      },
      {
        // The member bytes and the per-member hash move together; only the
        // declared aggregate is left stale.
        file: AVAILABLE,
        mutate: (result) => { result.completed_at = '2026-07-26T06:00:09Z'; },
        options: { rehashAggregate: false },
        pattern: /member_set_digest must be/i,
      },
    ]);
  }],

  ['rejects missing, unreadable and undeclared packet inputs', () => {
    withPacketCopy((contracts) => {
      rmSync(join(contracts, UNAVAILABLE));
      mutateJson(contracts, EXAMPLES_MANIFEST, (manifest) => {
        manifest.examples = manifest.examples
          .filter((entry) => `examples/alert-context/${entry.file}` !== UNAVAILABLE);
      });
      mutateJson(contracts, COMPATIBILITY, (manifest) => {
        manifest.members = manifest.members.filter((entry) => entry.file !== UNAVAILABLE);
      });
      expectFailure(validate(contracts), /filesystem inventory|must exactly cover/i);
    });
    withPacketCopy((contracts) => {
      rmSync(join(contracts, UNAVAILABLE));
      expectFailure(validate(contracts), /compatibility member missing/i);
    });
    withPacketCopy((contracts) => {
      rmSync(join(contracts, EXAMPLES_MANIFEST));
      expectFailure(validate(contracts), /missing packet file/i);
    });
    withPacketCopy((contracts) => {
      writeFileSync(join(contracts, COMPATIBILITY), '{ not json');
      const result = validate(contracts);
      expectFailure(result, /JSON parse error/i);
      assert.equal(result.status, 'MISSING_COMPATIBILITY_MANIFEST');
    });
    withPacketCopy((contracts) => {
      const emptyDependencyRoot = mkdtempSync(join(tmpdir(), 'cybrik-no-deps-'));
      try {
        expectFailure(validate(contracts, emptyDependencyRoot), /schema compilation failed/i);
      } finally {
        rmSync(emptyDependencyRoot, { recursive: true, force: true });
      }
    });
  }],

  ['rejects available-result context byte and alert-identity substitution', () => runTable([
    {
      file: AVAILABLE,
      mutate: (result) => {
        result.context.title = 'Substituted context with stale context_digest';
      },
      pattern: /context_digest.*RFC 8785/i,
    },
    {
      file: AVAILABLE,
      mutate: (result) => {
        result.context.alert_id = 'alert-substituted';
        refreshContextDigest(result);
      },
      pattern: /context alert_id.*must match request alert ref/i,
    },
    {
      file: AVAILABLE,
      mutate: (result) => {
        result.context.alert_digest = `sha256:${'9'.repeat(64)}`;
        refreshContextDigest(result);
      },
      pattern: /context alert_id.*must match request alert ref/i,
    },
  ])],

  ['rejects negative-semantic fixtures that stop being genuine runtime witnesses', () => runTable([
    {
      file: CROSS_TENANT,
      mutate: (request) => {
        request.authorization_binding.actor = structuredClone(request.actor);
      },
      pattern: /cross-tenant semantic fixture must differ/i,
    },
    {
      file: CROSS_ORG,
      mutate: (result) => {
        result.org_scope = { org_id: 'org-soc-east', include_descendants: false };
      },
      pattern: /cross-org semantic fixture must differ/i,
    },
    {
      file: CLEARANCE,
      mutate: (result) => {
        result.data_marking = { classification: 'internal', tlp: 'TLP:GREEN' };
      },
      pattern: /clearance-exceeded semantic fixture must exceed request clearance/i,
    },
    {
      file: DIGEST_MISMATCH,
      mutate: (result) => {
        result.alert_ref = {
          type: 'soc.alert',
          id: 'alert-0001',
          version: '17',
          digest: ALERT_DIGEST,
        };
        result.context.alert_id = 'alert-0001';
        result.context.alert_digest = ALERT_DIGEST;
      },
      pattern: /digest-mismatch semantic fixture must differ/i,
    },
    {
      file: CROSS_ORG,
      mutate: (result) => { result.context.title = 'Rewritten witness context'; },
      pattern: /semantic witness context_digest must remain valid/i,
    },
    {
      file: CLEARANCE,
      mutate: (result) => { result.unexpected_field = 'structurally invalid witness'; },
      pattern: /must remain structurally valid/i,
    },
  ])],

  ['rejects policy, capability, alert identity, and idempotency binding drift', () => runTable([
    {
      file: AVAILABLE,
      mutate: (result) => {
        result.policy_digest = `sha256:${'a'.repeat(64)}`;
        result.capability.digest = `sha256:${'b'.repeat(64)}`;
        result.alert_ref.version = '18';
        result.idempotency_key = 'different-idempotency-key';
      },
      pattern: /policy digest|capability.*digest|full alert ref|idempotency/i,
    },
    {
      file: AVAILABLE,
      mutate: (result) => { result.request_id = 'req-substituted'; },
      pattern: /must preserve request_id/i,
    },
    {
      file: AVAILABLE,
      mutate: (result) => { result.clearance = { classification: 'restricted', tlp: 'TLP:RED' }; },
      pattern: /must preserve clearance/i,
    },
  ])],

  ['rejects target-derived data on unavailable and idempotency-conflict outcomes', () => runTable([
    {
      file: UNAVAILABLE,
      mutate: (result) => { result.failure.target_exists = true; },
      pattern: /positive fixture failed schema validation/i,
    },
    {
      file: UNAVAILABLE,
      mutate: (result) => {
        result.alert_ref = {
          type: 'soc.alert',
          id: 'alert-0001',
          digest: ALERT_DIGEST,
        };
      },
      pattern: /positive fixture failed schema validation/i,
    },
    {
      file: UNAVAILABLE,
      mutate: (result) => { result.failure.code = 'alert_exists_but_access_denied'; },
      pattern: /positive fixture failed schema validation/i,
    },
  ])],
];

// ---------------------------------------------------------------------------
// 2 positive checks
// ---------------------------------------------------------------------------

const POSITIVE_CASES = [
  ['current packet is closed, coherently ACCEPTED FOR IMPLEMENTATION, and valid', () => {
    withPacketCopy((contracts) => {
      const result = validate(contracts);
      assert.equal(result.ok, true, result.errors.join('\n'));
      assert.equal(result.status, ACCEPTED_STATUS_TOKEN);
      assert.equal(result.acceptedOn, '2026-07-26');
      // Acceptance is a contract decision only: nothing below may flip with it.
      assert.equal(result.implementationStatus, 'NOT IMPLEMENTED');
      assert.equal(result.runtimeAuthorizationProven, false);
      assert.equal(result.noExistenceLeakRuntimeProven, false);
      assert.deepEqual(result.counts, {
        schemas_compiled: 1,
        positive_total: 3,
        positive_pass: 3,
        negative_schema_total: 4,
        negative_schema_reject: 4,
        negative_semantic_total: 4,
        negative_semantic_structurally_valid: 4,
        fixture_bindings_verified: 11,
        manifest_member_hashes_verified: 13,
        member_set_digest_verified: 1,
      });
    });

    // The declared wording cannot drift from the real suite shape.
    const manifest = readJson(join(SOURCE_CONTRACTS, COMPATIBILITY));
    assert.deepEqual(manifest.verification.test_case_counts, {
      adversarial_rejection_cases: REJECTION_CASES.length,
      positive_cases: POSITIVE_CASES.length,
      total_cases: REJECTION_CASES.length + POSITIVE_CASES.length,
    });
    // Every negative-schema fixture cites the corrected canonical label, and
    // that label is really declared in trust_invariants.structural.
    const structural = new Set(
      manifest.trust_invariants.structural.map((entry) => /^(TI-\d+)\s/.exec(entry)?.[1]),
    );
    const examples = readJson(join(SOURCE_CONTRACTS, EXAMPLES_MANIFEST)).examples;
    for (const [file, label] of Object.entries(EXPECTED_TRUST_INVARIANTS)) {
      const row = examples.find((entry) => entry.file === file);
      assert.match(row.invariant, new RegExp(`^${label} `), `${file} must cite ${label}`);
      assert.equal(structural.has(label), true, `${label} must exist in trust_invariants`);
    }

    assert.equal(manifest.member_set_integrity.member_count, manifest.members.length);
    assert.equal(
      manifest.member_set_integrity.member_set_digest,
      memberSetDigest(manifest.members),
    );

    // The acceptance record is internally coherent and deliberately bounded: the
    // lifecycle flipped, nothing about implementation, CI or runtime proof did.
    assert.equal(manifest.acceptance.status, 'ACCEPTED FOR IMPLEMENTATION');
    assert.equal(manifest['x-cybrik-status'], manifest.acceptance.status);
    assert.equal(manifest['x-cybrik-not-accepted'], false);
    assert.equal(manifest.acceptance.accepted_on, '2026-07-26');
    assert.equal(manifest.proof_limits.accepted_for_implementation, true);
    assert.equal(manifest.proof_limits.endpoint_or_transport_implemented, false);
    assert.equal(manifest.proof_limits.release_ready, false);
    assert.equal(manifest.capability_scope.implementation_status, 'NOT IMPLEMENTED');
    assert.match(manifest.verification.ci_wiring, /^NOT WIRED\./);
    assert.deepEqual(manifest.acceptance.open_runtime_obligations, ['TR-7', 'TR-8', 'TR-9']);
    for (const label of manifest.acceptance.open_runtime_obligations) {
      assert.equal(
        manifest.trust_invariants.runtime_only_declared
          .some((entry) => entry.startsWith(`${label} `)),
        true,
        `${label} must stay declared as an open runtime obligation`,
      );
    }

    // Every fixture binding pins the post-flip schema bytes, so the acceptance
    // cascade left no stale binding behind.
    const liveSchemaDigest = `sha256:${sha256(readFileSync(join(SOURCE_CONTRACTS, SCHEMA)))}`;
    assert.notEqual(liveSchemaDigest, SUPERSEDED_SCHEMA_DIGEST);
    for (const row of examples) {
      const fixture = readJson(join(SOURCE_CONTRACTS, 'examples/alert-context', row.file));
      assert.equal(
        fixture.authorization_binding.schema_digest,
        liveSchemaDigest,
        `${row.file} must pin the current schema bytes`,
      );
    }

    // Non-circularity: the aggregate is computed over members[] only, so
    // rewriting an unrelated manifest key leaves the declared digest valid.
    withPacketCopy((contracts) => {
      mutateJson(contracts, COMPATIBILITY, (candidate) => {
        candidate.residual_questions.push(
          'Non-member manifest prose must not participate in the member-set aggregate.',
        );
      });
      const result = validate(contracts);
      assert.equal(result.ok, true, result.errors.join('\n'));
      assert.equal(result.counts.member_set_digest_verified, 1);
    });
  }],

  ['accepts the closed idempotency-conflict shape without target-derived fields', () => {
    withPacketCopy((contracts) => {
      mutateJson(contracts, UNAVAILABLE, (result) => {
        result.outcome = 'idempotency_conflict';
        result.idempotency_disposition = 'conflict';
        result.failure.code = 'idempotency_binding_conflict';
      });
      const result = validate(contracts);
      assert.equal(result.ok, true, result.errors.join('\n'));
    });
  }],
];

for (const [name, run] of REJECTION_CASES) test(name, run);
for (const [name, run] of POSITIVE_CASES) test(name, run);
