// Standalone test suite for the W1 `soc.get_alert_context` transport-binding
// packet validator. The packet it exercises is ACCEPTED FOR IMPLEMENTATION on
// 2026-07-27 and NOT IMPLEMENTED.
//
// The suite holds exactly 32 adversarial rejection cases plus 3 positive checks.
// Several adversarial cases are table-driven over multiple mutations; every
// mutation must be rejected. `POSITIVE_CASES[0]` asserts that the compatibility
// manifest's declared `verification.test_case_counts` still equals the real
// case-array lengths, so the declared wording cannot drift from the suite.
//
// Passing proves static binding-packet integrity and lifecycle coherence only.
// Acceptance is a recorded contract decision, not evidence: passing implements
// no endpoint, adds no OpenAPI / AsyncAPI / MCP surface, registers no
// capability, grants no Fabric invocation, wires no CI, deploys nothing, tags no
// Bundle, and proves no runtime authorization or kill-switch behavior. TR-4…TR-8
// stay open runtime obligations and the suite fails closed if the packet tries
// to close them, half-flip the lifecycle, keep stale proposal language, or turn
// W2-F inference delegation into Fabric tool authority. The bound-receipt
// profile is exercised here against synthesized receipt documents because the
// packet deliberately ships no receipt fixture.

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
  boundOutputProjection,
  canonicalizeJcs,
  checkBoundReceipt,
  compileBindingSchema,
  reconstructBusinessRequest,
  resolvedArgumentsDigest,
  validateAlertContextTransportBindingPacket,
} from '../validate-alert-context-transport.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');
const SOURCE_CONTRACTS = join(REPO_ROOT, 'contracts');
const DEPENDENCY_ROOT = process.env.CYBRIK_CONTRACT_VALIDATION_DEPS_ROOT
  || resolve(REPO_ROOT, 'tools/contract-validation');

const COMPATIBILITY =
  'compatibility/cybrik-suite-alert-context-transport-binding.v1.manifest.json';
const SCHEMA = 'json-schema/cybrik.soc-alert-context-invocation-binding.v1.schema.json';
const EXAMPLES_MANIFEST = 'examples/alert-context-transport/examples-manifest.json';
const SOURCE_MANIFEST = 'compatibility/cybrik-suite-alert-context-packet.v1.manifest.json';
const SOURCE_SCHEMA = 'json-schema/cybrik.soc-get-alert-context.v1.schema.json';
const SOURCE_REQUEST = 'examples/alert-context/positive/request.json';
const W2F_TOKEN = 'examples/svc/positive/svc-delegation-token.json';

const REQUEST = 'examples/alert-context-transport/positive/bound-request.json';
const AVAILABLE = 'examples/alert-context-transport/positive/bound-result.available.json';
const UNAVAILABLE =
  'examples/alert-context-transport/positive/bound-result.unavailable.json';
const KILL_SWITCH =
  'examples/alert-context-transport/positive/bound-result.kill-switch-denied.json';
const ARGS_BINDING = 'examples/alert-context-transport/negative-schema/'
  + 'bound-request.authorization-binding-asserted.json';
const PIN_MISMATCH = 'examples/alert-context-transport/negative-schema/'
  + 'bound-request.capability-pin-mismatch.json';
const IDEM_MISMATCH = 'examples/alert-context-transport/negative-semantic/'
  + 'bound-request.idempotency-key-mismatch.json';
const TENANT_MISMATCH = 'examples/alert-context-transport/negative-semantic/'
  + 'bound-request.tenant-mismatch.json';
const W2F_AS_DELEGATION = 'examples/alert-context-transport/negative-semantic/'
  + 'bound-request.w2f-token-as-delegation-ref.json';

// Derived by the validator from the real manifest bytes, never asserted by it:
// a lifecycle regression or half-flip prints a token that differs from this one.
const ACCEPTED_STATUS_TOKEN = 'ACCEPTED_FOR_IMPLEMENTATION_NOT_ACCEPTED_FLAG=false';
const ACCEPTED_ON = '2026-07-27';
const GATE_DOC = 'docs/releases/GATE-W1-C1-TRANSPORT-BINDING.md';
const OPEN_RUNTIME_OBLIGATIONS = ['TR-4', 'TR-5', 'TR-6', 'TR-7', 'TR-8'];
// The acceptance is bounded: each of these must stay an explicitly declared
// non-claim, so no later reader can mistake the recorded decision for a runtime,
// transport, registry, grant, deployment, CI, Bundle or release gate.
const EXPECTED_NON_CLAIMS = [
  'no runtime implementation or runtime behavior is accepted, verified or demonstrated',
  'no endpoint, path, operation, queue, AsyncAPI channel or MCP transport surface is accepted',
  'no capability-registry entry is accepted or registered',
  'no Fabric tool-execution grant is accepted or minted, and W2-F inference delegation is '
    + 'never Fabric tool authority',
  'no deployment, environment rollout or operational enablement is accepted',
  'no CI wiring or pipeline registration is accepted',
  'no Bundle v0.1.1 membership or bundle tag is accepted',
  'no merge, push, release or release certification is accepted',
];

// Independent expectation of which canonical trust invariant each negative
// fixture witnesses. The compatibility manifest owns the label text; the
// examples manifest may only cite a label declared there.
const EXPECTED_TRUST_INVARIANTS = {
  'negative-schema/bound-request.authorization-binding-asserted.json': 'TB-3',
  'negative-schema/bound-request.capability-pin-mismatch.json': 'TB-2',
  'negative-schema/bound-result.approval-required.json': 'TB-4',
  'negative-schema/bound-result.output-artifact-locator.json': 'TB-8',
  'negative-schema/bound-result.unavailable-with-output.json': 'TB-6',
  'negative-schema/bound-result.completed-without-receipt.json': 'TB-7',
  'negative-semantic/bound-request.idempotency-key-mismatch.json': 'TR-1',
  'negative-semantic/bound-request.tenant-mismatch.json': 'TR-2',
  'negative-semantic/bound-request.w2f-token-as-delegation-ref.json': 'TR-3',
};

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const jcsDigest = (value) => `sha256:${sha256(Buffer.from(canonicalizeJcs(value), 'utf8'))}`;
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

// Independent re-implementation of the declared non-circular member-set
// algorithm: reduce each member row to its four allowlisted fields, sort by
// file, and digest the constrained-JCS bytes of that array only. No other
// manifest key — including the block that carries the result — is an input.
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

// The whole contracts tree is copied because this packet deliberately pins the
// bytes of the accepted C1 source packet, the reused W2-B envelope schemas and
// the accepted W2-F delegation-token fixture it cites as a witness anchor.
const withPacketCopy = (run) => {
  const root = mkdtempSync(join(tmpdir(), 'cybrik-alert-context-transport-'));
  const contracts = join(root, 'contracts');
  cpSync(SOURCE_CONTRACTS, contracts, { recursive: true });
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

const validate = (contracts, dependencyRoot = DEPENDENCY_ROOT) =>
  validateAlertContextTransportBindingPacket({
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

const refreshOutputDigest = (boundResult) => {
  boundResult.output.output_digest = jcsDigest(boundOutputProjection(boundResult));
};

// Re-signs every digest the mutated bound result feeds, so each schema row proves
// the structural allowlist rejects the change on its own merits.
const resignBoundResults = (contracts) => {
  const manifestPath = join(contracts, COMPATIBILITY);
  const manifest = readJson(manifestPath);
  for (const relativePath of [AVAILABLE, UNAVAILABLE]) {
    const path = join(contracts, relativePath);
    const boundResult = readJson(path);
    if (boundResult.output) refreshOutputDigest(boundResult);
    writeJson(path, boundResult);
    const member = manifest.members.find((candidate) => candidate.file === relativePath);
    if (member) member.sha256 = sha256(readFileSync(path));
  }
  writeJson(manifestPath, manifest);
  refreshAggregate(contracts);
};

const expectSchemaRejected = (mutate, pattern) => expectRejected({
  file: SCHEMA,
  mutate,
  pattern,
  after: resignBoundResults,
});

const syntheticReceipt = (contracts, overrides = {}) => {
  const boundRequest = readJson(join(contracts, REQUEST));
  const boundResult = readJson(join(contracts, AVAILABLE));
  return {
    receipt: {
      receipt_id: boundResult.receipt_id,
      action_id: boundRequest.action_id,
      tenant_id: boundRequest.tenant_id,
      status: 'completed',
      capability: structuredClone(boundRequest.capability),
      executor: {
        id: 'spiffe://cybrik/tenant-acme/fabric/executor/soc-read',
        isolation_profile: 'S0',
      },
      policy_decision_id: boundResult.policy_decision_id,
      delegation_ref: boundRequest.delegation_ref,
      resolved_arguments_digest: resolvedArgumentsDigest(boundRequest),
      started_at: '2026-07-26T06:00:00Z',
      finished_at: '2026-07-26T06:00:01Z',
      input_artifact_digests: [],
      output_artifacts: [],
      side_effect: { performed: false },
      receipt_digest: `sha256:${'7'.repeat(64)}`,
      signature: 'cybrik://fabric/receipt-signature/deferred-envelope/'
        + `${boundResult.receipt_id}`,
      ...overrides,
    },
    boundRequest,
    boundResult,
  };
};

// ---------------------------------------------------------------------------
// 32 adversarial rejection cases
// ---------------------------------------------------------------------------

const REJECTION_CASES = [
  ['rejects caller-asserted authorization binding and closed-argument drift', () => {
    expectSchemaRejected(
      (schema) => {
        schema.$defs.callerArguments.properties.authorization_binding = { type: 'object' };
      },
      /callerArguments must not admit authorization_binding/i,
    );
    expectSchemaRejected(
      (schema) => { schema.$defs.callerArguments.additionalProperties = true; },
      /callerArguments: additionalProperties must be false/i,
    );
    expectSchemaRejected(
      (schema) => { schema.$defs.callerArguments.properties.inline_alert = { type: 'object' }; },
      /callerArguments properties.*(?:unexpected key|exact allowlist)/i,
    );
    runTable([
      {
        file: REQUEST,
        mutate: (boundRequest) => { boundRequest.arguments.execution_grant = 'granted'; },
        pattern: /positive fixture failed schema validation/i,
      },
    ]);
  }],

  ['rejects capability pin drift across envelope, business binding and receipt', () => {
    expectSchemaRejected(
      (schema) => {
        schema.$defs.boundCapabilityPin.properties.version = { const: '0.2.0' };
      },
      /capability pin must be exact soc\.get_alert_context@0\.1\.0/i,
    );
    runTable([
      {
        file: REQUEST,
        mutate: (boundRequest) => {
          boundRequest.capability.digest = `sha256:${'a'.repeat(64)}`;
        },
        pattern: /capability pin must equal the envelope capability pin/i,
      },
      {
        file: AVAILABLE,
        mutate: (boundResult) => {
          boundResult.output.data.capability.risk_class = 'R1';
          refreshOutputDigest(boundResult);
        },
        pattern: /positive fixture failed schema validation|must stay R0/i,
      },
    ]);
    withPacketCopy((contracts) => {
      const { receipt, boundRequest, boundResult } = syntheticReceipt(contracts, {
        capability: {
          name: 'soc.get_alert_context',
          version: '0.1.0',
          digest: `sha256:${'b'.repeat(64)}`,
        },
      });
      const errors = checkBoundReceipt(receipt, boundRequest, boundResult);
      assert.match(errors.join('\n'), /receipt capability pin must equal/i);
    });
  }],

  ['rejects non-execute dispatch and forbidden transport channels', () => {
    expectSchemaRejected(
      (schema) => {
        schema.$defs.boundRequest.allOf[1].properties.execution.properties.mode = {
          enum: ['execute', 'dry_run'],
        };
      },
      /execution mode must be exact execute/i,
    );
    expectSchemaRejected(
      (schema) => { delete schema.$defs.boundRequest.allOf[1].not; },
      /bound request must forbid resource_scope/i,
    );
    runTable([
      {
        file: REQUEST,
        mutate: (boundRequest) => { boundRequest.execution.mode = 'dry_run'; },
        pattern: /positive fixture failed schema validation/i,
      },
      {
        file: REQUEST,
        mutate: (boundRequest) => {
          boundRequest.resource_scope = { resource_patterns: ['alert:alert-0001'] };
        },
        pattern: /positive fixture failed schema validation/i,
      },
    ]);
  }],

  ['rejects envelope statuses excluded by the synchronous R0 profile', () => {
    expectSchemaRejected(
      (schema) => {
        schema.$defs.boundResult.allOf[1].properties.status.enum.push('approval_required');
      },
      /bound result status set must be exactly/i,
    );
    expectSchemaRejected(
      (schema) => {
        schema.$defs.boundResult.allOf[1].properties.status.enum.push('queued');
      },
      /bound result status set must be exactly/i,
    );
    runTable([
      {
        file: UNAVAILABLE,
        mutate: (boundResult) => { boundResult.status = 'queued'; },
        pattern: /positive fixture failed schema validation/i,
      },
      {
        file: KILL_SWITCH,
        mutate: (boundResult) => {
          boundResult.status = 'approval_required';
          boundResult.approval_id = 'apr-0001';
          delete boundResult.error;
        },
        pattern: /positive fixture failed schema validation/i,
      },
    ]);
  }],

  ['rejects business output carried on a non-completed envelope status', () => {
    expectSchemaRejected(
      (schema) => {
        delete schema.$defs.boundResult.allOf[1].allOf[1].then.not;
      },
      /non-completed bound result must forbid business output/i,
    );
    runTable([
      {
        file: KILL_SWITCH,
        mutate: (boundResult) => {
          boundResult.output = { data: { message_type: 'result' } };
        },
        pattern: /positive fixture failed schema validation/i,
      },
    ]);
  }],

  ['rejects completed bound results without a receipt or with an error', () => {
    expectSchemaRejected(
      (schema) => {
        schema.$defs.boundResult.allOf[1].allOf[0].then.required =
          schema.$defs.boundResult.allOf[1].allOf[0].then.required
            .filter((key) => key !== 'receipt_id');
      },
      /completed bound result must require receipt_id and inline output/i,
    );
    runTable([
      {
        file: AVAILABLE,
        mutate: (boundResult) => { delete boundResult.receipt_id; },
        pattern: /positive fixture failed schema validation/i,
      },
      {
        file: AVAILABLE,
        mutate: (boundResult) => {
          boundResult.error = { code: 'FABRIC_EXECUTION_FAILED', retryable: false };
        },
        pattern: /positive fixture failed schema validation/i,
      },
    ]);
  }],

  ['rejects artifact locators and truncated business output', () => {
    expectSchemaRejected(
      (schema) => {
        schema.$defs.boundResult.allOf[1].properties.output_artifacts = { type: 'array' };
      },
      /bound result must forbid output artifacts/i,
    );
    runTable([
      {
        file: AVAILABLE,
        mutate: (boundResult) => {
          boundResult.output_artifacts = [{
            locator: 'cybrik://fabric/artifact/0001',
            digest: `sha256:${'c'.repeat(64)}`,
            media_type: 'application/json',
          }];
        },
        pattern: /positive fixture failed schema validation/i,
      },
      {
        file: AVAILABLE,
        mutate: (boundResult) => { boundResult.output.truncated = true; },
        pattern: /positive fixture failed schema validation/i,
      },
    ]);
  }],

  ['rejects kill-switch denials that leak a receipt, output or retryable error', () => {
    expectSchemaRejected(
      (schema) => { delete schema.$defs.boundResult.allOf[1].allOf[2]; },
      /denied bound result must forbid receipt_id/i,
    );
    runTable([
      {
        file: KILL_SWITCH,
        mutate: (boundResult) => { boundResult.receipt_id = 'rcpt-alert-context-0001'; },
        pattern: /positive fixture failed schema validation/i,
      },
      {
        file: KILL_SWITCH,
        mutate: (boundResult) => { boundResult.error.retryable = true; },
        pattern: /positive fixture failed schema validation/i,
      },
      {
        file: KILL_SWITCH,
        mutate: (boundResult) => { boundResult.error.code = 'FABRIC_POLICY_OTHER_DENIAL'; },
        pattern: /kill-switch denial must carry the declared fail-closed code/i,
      },
    ]);
  }],

  ['rejects bound-output projection digest drift', () => runTable([
    {
      file: AVAILABLE,
      mutate: (boundResult) => {
        boundResult.output.output_digest = `sha256:${'d'.repeat(64)}`;
      },
      pattern: /output_digest must match the constrained-JCS bound-output projection/i,
    },
    {
      file: UNAVAILABLE,
      mutate: (boundResult) => { boundResult.action_id = 'act-alert-context-9999'; },
      pattern: /action_id must equal the bound request action_id/i,
    },
  ])],

  ['rejects business context_digest drift under the reused C1 projection', () => runTable([
    {
      file: AVAILABLE,
      mutate: (boundResult) => {
        boundResult.output.data.context.title = 'Substituted context';
        refreshOutputDigest(boundResult);
      },
      pattern: /context_digest must match the reused C1 available-result projection/i,
    },
    {
      file: AVAILABLE,
      mutate: (boundResult) => {
        boundResult.output.data.context_digest = `sha256:${'e'.repeat(64)}`;
        refreshOutputDigest(boundResult);
      },
      pattern: /context_digest must match the reused C1 available-result projection/i,
    },
  ])],

  ['rejects business payloads that stop being the accepted C1 result bytes', () => runTable([
    {
      file: AVAILABLE,
      mutate: (boundResult) => {
        boundResult.output.data.completed_at = '2026-07-26T06:00:09Z';
        refreshOutputDigest(boundResult);
      },
      pattern: /business result must be byte-identical to the accepted C1 result fixture/i,
    },
    {
      file: UNAVAILABLE,
      mutate: (boundResult) => {
        boundResult.output.data.idempotency_disposition = 'replayed';
        refreshOutputDigest(boundResult);
      },
      pattern: /business result must be byte-identical to the accepted C1 result fixture/i,
    },
  ])],

  ['rejects reconstruction drift from the accepted C1 business request bytes', () => runTable([
    {
      file: REQUEST,
      mutate: (boundRequest) => { boundRequest.purpose = 'threat_hunting'; },
      pattern: /reconstructed C1 business request must be byte-identical/i,
    },
    {
      file: REQUEST,
      mutate: (boundRequest) => {
        boundRequest.data_marking = { classification: 'confidential', tlp: 'TLP:AMBER' };
      },
      pattern: /reconstructed C1 business request must be byte-identical/i,
    },
    {
      file: REQUEST,
      mutate: (boundRequest) => { boundRequest.arguments.requested_at = '2026-07-26T06:00:05Z'; },
      pattern: /reconstructed C1 business request must be byte-identical/i,
    },
    {
      file: REQUEST,
      mutate: (boundRequest) => { delete boundRequest.arguments.traceparent; },
      pattern: /reconstructed C1 business request must be byte-identical|traceparent/i,
    },
  ])],

  ['rejects reconstruction bounds overflow while the exact 200 boundary stays valid', () => {
    // The accepted W2-B envelope declares only a lower bound on both fields, so
    // nothing but this profile's narrowing rejects an overflowing bound request
    // before it is reconstructed into a C1 business request C1 would refuse.
    runTable([
      {
        file: REQUEST,
        mutate: (boundRequest) => { boundRequest.purpose = 'p'.repeat(201); },
        pattern: /positive fixture failed schema validation/i,
      },
      {
        file: REQUEST,
        mutate: (boundRequest) => { boundRequest.idempotency_key = 'k'.repeat(201); },
        pattern: /positive fixture failed schema validation/i,
      },
    ]);
    expectSchemaRejected(
      (schema) => { delete schema.$defs.boundRequest.allOf[1].properties.purpose.maxLength; },
      /bound request purpose must be narrowed to the accepted C1 business-request bound 1\.\.200/i,
    );
    expectSchemaRejected(
      (schema) => {
        schema.$defs.boundRequest.allOf[1].properties.idempotency_key.minLength = 1;
      },
      /bound request idempotency_key must be narrowed to the accepted C1 business-request bound 16\.\.200/i,
    );
    // The boundary itself stays inside the profile: exactly 200 characters is
    // schema-valid on both fields and still reconstructs into a document the
    // accepted C1 request branch accepts. One character more is outside it.
    withPacketCopy((contracts) => {
      const { validate: validateSchema, validateBusinessRequest } = compileBindingSchema({
        contractsRoot: contracts,
        dependencyRoot: DEPENDENCY_ROOT,
      });
      const boundRequest = readJson(join(contracts, REQUEST));
      boundRequest.purpose = 'p'.repeat(200);
      boundRequest.idempotency_key = 'k'.repeat(200);
      assert.equal(validateSchema(boundRequest), true);
      const binding = readJson(join(contracts, AVAILABLE)).output.data.authorization_binding;
      assert.equal(
        validateBusinessRequest(reconstructBusinessRequest(boundRequest, binding)),
        true,
      );
      assert.equal(validateSchema({ ...boundRequest, purpose: 'p'.repeat(201) }), false);
      assert.equal(
        validateSchema({ ...boundRequest, idempotency_key: 'k'.repeat(201) }),
        false,
      );
    });
  }],

  ['rejects identity and scope completion drift', () => runTable([
    {
      file: REQUEST,
      mutate: (boundRequest) => { boundRequest.actor.id = 'membership-analyst-99'; },
      pattern: /identity completion: envelope actor must equal/i,
    },
    {
      file: REQUEST,
      mutate: (boundRequest) => { boundRequest.arguments.org_scope.include_descendants = true; },
      pattern: /scope completion: caller org_scope must equal/i,
    },
    {
      file: REQUEST,
      mutate: (boundRequest) => { boundRequest.tenant_id = 'tenant-globex'; },
      pattern: /tenant completion: envelope tenant_id must equal/i,
    },
    {
      file: REQUEST,
      mutate: (boundRequest) => { boundRequest.actor.tenant_id = 'tenant-globex'; },
      pattern: /envelope actor tenant must equal the envelope authoritative tenant/i,
    },
  ])],

  ['rejects idempotency-key drift across the four bound positions', () => runTable([
    {
      file: REQUEST,
      mutate: (boundRequest) => {
        boundRequest.idempotency_key = 'idem-alert-context-rebound-0001';
      },
      pattern: /quadruple idempotency-key equality/i,
    },
    {
      file: AVAILABLE,
      mutate: (boundResult) => {
        boundResult.output.data.idempotency_key = 'idem-alert-context-other-0001';
        refreshOutputDigest(boundResult);
      },
      pattern: /quadruple idempotency-key equality|byte-identical to the accepted C1 result/i,
    },
  ])],

  ['rejects request_id and traceparent correlation drift', () => runTable([
    {
      file: REQUEST,
      mutate: (boundRequest) => { boundRequest.arguments.request_id = 'req-substituted'; },
      pattern: /business request_id must equal the caller-argument request_id/i,
    },
    {
      file: REQUEST,
      mutate: (boundRequest) => {
        boundRequest.arguments.traceparent =
          '00-33333333333333333333333333333333-4444444444444444-01';
      },
      pattern: /traceparent must be identical across the caller arguments and the business result/i,
    },
  ])],

  ['rejects injected and drifting result-side traceparent', () => runTable([
    {
      // Drift: the business result carries a trace context that is not the one
      // the caller asserted.
      file: AVAILABLE,
      mutate: (boundResult) => {
        boundResult.output.data.traceparent =
          '00-55555555555555555555555555555555-6666666666666666-01';
        refreshOutputDigest(boundResult);
      },
      pattern: /traceparent must be identical across the caller arguments and the business result/i,
    },
    {
      // Injection: the caller asserted no trace context at all, so a result-side
      // traceparent is minted rather than carried. Omission on the result side
      // stays permitted — the unavailable fixture carries none and is silent
      // here — but fabrication never is.
      file: REQUEST,
      mutate: (boundRequest) => { delete boundRequest.arguments.traceparent; },
      pattern: /traceparent must be identical across the caller arguments and the business result/i,
    },
  ])],

  ['rejects a stale accepted-C1 schema pin inside the completed business binding', () => {
    runTable([
      {
        file: AVAILABLE,
        mutate: (boundResult) => {
          boundResult.output.data.authorization_binding.schema_digest =
            `sha256:${'f'.repeat(64)}`;
          refreshOutputDigest(boundResult);
        },
        pattern: /schema_digest must pin the exact accepted C1 schema bytes/i,
      },
    ]);
    withPacketCopy((contracts) => {
      mutateJson(contracts, SOURCE_SCHEMA, (schema) => {
        schema.$defs.alertContext.properties.title.maxLength = 501;
      }, { rehash: false });
      expectFailure(
        validate(contracts),
        /schema_digest must pin the exact accepted C1 schema bytes|source_members/i,
      );
    });
  }],

  ['rejects lifecycle regressions, half-flips and supersession claims', () => {
    withPacketCopy((contracts) => {
      // A full regression back to the proposal lifecycle is refused: the
      // recorded decision may not be silently withdrawn by editing bytes.
      mutateJson(contracts, COMPATIBILITY, (manifest) => {
        manifest['x-cybrik-status'] = 'PROPOSED — NOT ACCEPTED';
        manifest['x-cybrik-not-accepted'] = true;
      });
      const result = validate(contracts);
      expectFailure(result, /must be 'ACCEPTED FOR IMPLEMENTATION'/i);
      assert.notEqual(result.status, ACCEPTED_STATUS_TOKEN);
    });
    runTable([
      {
        file: SCHEMA,
        mutate: (schema) => { schema['x-cybrik-not-accepted'] = true; },
        pattern: /x-cybrik-not-accepted must be false/i,
      },
      {
        file: EXAMPLES_MANIFEST,
        mutate: (manifest) => { manifest['x-cybrik-contract-version'] = '0.2.0'; },
        pattern: /x-cybrik-contract-version must be 0\.1\.0/i,
      },
      {
        // Half-flip: one lifecycle document is left behind at the proposal
        // state while the other two carry the acceptance.
        file: SCHEMA,
        mutate: (schema) => {
          schema['x-cybrik-status'] = 'PROPOSED — NOT ACCEPTED';
          schema['x-cybrik-not-accepted'] = true;
        },
        pattern: /lifecycle half-flip|stale proposal lifecycle text/i,
      },
      {
        file: EXAMPLES_MANIFEST,
        mutate: (manifest) => {
          manifest['x-cybrik-status'] = 'PROPOSED — NOT ACCEPTED';
          manifest['x-cybrik-not-accepted'] = true;
        },
        pattern: /lifecycle half-flip|stale proposal lifecycle text/i,
      },
    ]);
  }],

  ['rejects stale proposal language surviving the acceptance flip', () => runTable([
    {
      file: EXAMPLES_MANIFEST,
      mutate: (manifest) => {
        manifest.description = `${manifest.description} Status: PROPOSED.`;
      },
      pattern: /stale proposal lifecycle text/i,
    },
    {
      file: SCHEMA,
      mutate: (schema) => { schema.description = `${schema.description} NOT ACCEPTED.`; },
      pattern: /stale proposal lifecycle text/i,
      after: resignBoundResults,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => {
        manifest.description = `${manifest.description} This is a proposal-only packet.`;
      },
      pattern: /stale proposal lifecycle text/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => {
        manifest.description = `${manifest.description} It records no acceptance.`;
      },
      pattern: /stale proposal lifecycle text/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => {
        manifest.description = `${manifest.description} This packet supersedes the C1 packet.`;
      },
      pattern: /supersession claim must not appear/i,
    },
  ])],

  ['rejects a missing, drifting or half-flipped acceptance record', () => {
    runTable([
      {
        file: COMPATIBILITY,
        mutate: (manifest) => { delete manifest.acceptance; },
        pattern: /missing key 'acceptance'/i,
      },
      {
        // Half-flip: the acceptance block disagrees with the declared lifecycle.
        file: COMPATIBILITY,
        mutate: (manifest) => {
          manifest.acceptance.status = 'PROPOSED — NOT ACCEPTED';
        },
        pattern: /lifecycle half-flip|stale proposal lifecycle text/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => { manifest.acceptance.accepted_on = '2026-07-26'; },
        pattern: /accepted_on must be 2026-07-27/i,
      },
      {
        // The acceptance must remain traceable to its gate record.
        file: COMPATIBILITY,
        mutate: (manifest) => {
          manifest.acceptance.decision_record = 'Accepted by the W1 coordinator.';
        },
        pattern: /decision_record must cite the gate record/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => { manifest.acceptance.non_claims.pop(); },
        pattern: /acceptance\.non_claims must match the independent exact/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => {
          manifest.acceptance.non_claims[3] =
            'W2-F delegation may stand in for a Fabric tool grant.';
        },
        pattern: /acceptance\.non_claims must match the independent exact/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => { manifest.acceptance.settled_checklist = []; },
        pattern: /settled_checklist must record at least one settled question/i,
      },
      {
        // Acceptance settles contract shape, never runtime behavior: TR-4…TR-8
        // must all stay open inside the acceptance record itself.
        file: COMPATIBILITY,
        mutate: (manifest) => {
          manifest.acceptance.open_runtime_obligations =
            manifest.acceptance.open_runtime_obligations.filter((label) => label !== 'TR-5');
        },
        pattern: /acceptance\.open_runtime_obligations must be exactly/i,
      },
      {
        // The acceptance record and the packet-level obligation list may not
        // drift apart, in either direction.
        file: COMPATIBILITY,
        mutate: (manifest) => {
          manifest.acceptance.open_runtime_obligations = [...OPEN_RUNTIME_OBLIGATIONS, 'TR-9'];
        },
        pattern: /acceptance\.open_runtime_obligations must be exactly/i,
      },
      {
        // Lifecycle coherence in the other direction: the proof limit may not
        // stay at the proposal value once the lifecycle is accepted.
        file: COMPATIBILITY,
        mutate: (manifest) => { manifest.proof_limits.accepted_for_implementation = false; },
        pattern: /accepted_for_implementation must be true|lifecycle half-flip/i,
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
    ]);
  }],


  ['rejects manifest claim, verification-command and source-pin drift', () => {
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
        mutate: (manifest) => { manifest.proof_limits.kill_switch_runtime_proven = true; },
        pattern: /kill_switch_runtime_proven must stay false/i,
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
        mutate: (manifest) => { manifest.verification.standalone_test_command = 'npm test'; },
        pattern: /verification\.standalone_test_command must match/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => { manifest.verification.standalone_coverage_command = 'node --test'; },
        pattern: /verification\.standalone_coverage_command must match/i,
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
        mutate: (manifest) => {
          manifest.verification.test_case_counts.adversarial_rejection_cases = 11;
        },
        pattern: /verification\.test_case_counts must match/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => { manifest.source_packet.source_commit = '0'.repeat(40); },
        pattern: /source_packet\.source_commit must be/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => { manifest.source_packet.source_member_count = 12; },
        pattern: /source_packet\.source_member_count must be 13/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => {
          manifest.source_packet.source_member_set_digest = `sha256:${'1'.repeat(64)}`;
        },
        pattern: /source_packet\.source_member_set_digest must be/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => { manifest.source_packet.source_members[0].sha256 = '2'.repeat(64); },
        pattern: /source_packet source member .* sha256 must be/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => { manifest.source_packet.source_manifest_sha256 = '3'.repeat(64); },
        pattern: /source_packet\.source_manifest_sha256 must be/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => { manifest.reused_unmodified[0].sha256 = '4'.repeat(64); },
        pattern: /reused_unmodified .* sha256 must be/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => { manifest.reused_unmodified.pop(); },
        pattern: /reused_unmodified must exactly cover/i,
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
          manifest.completion_semantics.order = 'Bind first, authorize later.';
        },
        pattern: /completion semantics must include/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => { manifest.canonicalization.standard = 'Bespoke JSON, SHA-1.'; },
        pattern: /canonicalization must pin RFC 8785/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => {
          manifest.canonicalization.resolved_arguments_projection.push('cache_key');
        },
        pattern: /resolved_arguments_projection must match/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => {
          manifest.canonicalization.bound_output_projection[1] = 'output_digest';
        },
        pattern: /bound_output_projection must match/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => {
          manifest.canonicalization.business_request_reconstruction_projection.pop();
        },
        pattern: /business_request_reconstruction_projection must match/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => {
          manifest.member_set_integrity.algorithm = 'SHA-256 over the whole manifest bytes.';
        },
        pattern: /member_set_integrity\.algorithm must match/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => { manifest.member_set_integrity.member_count = 14; },
        pattern: /member_count must be 15/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => {
          manifest.member_set_integrity.member_set_digest = `sha256:${'5'.repeat(64)}`;
        },
        pattern: /member_set_digest must be/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => { manifest.members[0].sha256 = '6'.repeat(64); },
        pattern: /sha256 must be/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => { manifest.members[0].contract_version = '0.2.0'; },
        pattern: /outside exact file\/kind\/version allowlist/i,
      },
      {
        // The member bytes and the per-member hash move together; only the
        // declared aggregate is left stale.
        file: KILL_SWITCH,
        mutate: (boundResult) => {
          boundResult.error.message = 'Dispatch disabled by the fail-closed kill switch.';
        },
        options: { rehashAggregate: false },
        pattern: /member_set_digest must be/i,
      },
    ]);
  }],

  ['rejects orphan, symlinked, missing and unreadable packet inputs', () => {
    withPacketCopy((contracts) => {
      writeJson(join(contracts, 'examples/alert-context-transport/orphan.json'), {
        status: 'must-not-be-ignored',
      });
      expectFailure(validate(contracts), /filesystem inventory.*orphan/i);
    });
    withPacketCopy((contracts) => {
      symlinkSync(
        join(contracts, AVAILABLE),
        join(contracts, 'examples/alert-context-transport/positive/bound-result.link.json'),
      );
      expectFailure(validate(contracts), /orphan=SYMLINK:/);
    });
    withPacketCopy((contracts) => {
      rmSync(join(contracts, KILL_SWITCH));
      expectFailure(validate(contracts), /compatibility member missing|filesystem inventory/i);
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

  ['rejects example-row, traceability, allowlist and duplicate-row tampering', () => {
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
        mutate: (manifest) => {
          manifest.examples[0].file = 'positive/bound-request.renamed.json';
        },
        pattern: /outside exact filename\/kind allowlist/i,
      },
      {
        file: EXAMPLES_MANIFEST,
        mutate: (manifest) => {
          const row = manifest.examples.find((entry) =>
            entry.file === 'negative-schema/bound-result.approval-required.json');
          row.invariant = row.invariant.replace(/^TB-4 /, 'TB-1 ');
        },
        pattern: /expected trust invariant must be TB-4, got TB-1/i,
      },
      {
        file: EXAMPLES_MANIFEST,
        mutate: (manifest) => {
          const row = manifest.examples.find((entry) =>
            entry.file === 'negative-semantic/bound-request.tenant-mismatch.json');
          row.invariant = row.invariant.replace(/^TR-2 /, '');
        },
        pattern: /invariant must start with a canonical TB-<n> or TR-<n> label/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => {
          manifest.trust_invariants.structural = manifest.trust_invariants.structural
            .map((entry) => entry.replace(/^TB-8 /, 'TB-19 '));
        },
        pattern: /TB-8 is absent from the compatibility trust invariants/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => {
          manifest.trust_invariants.runtime_only_fixture_exercised =
            manifest.trust_invariants.runtime_only_fixture_exercised
              .filter((entry) => !entry.startsWith('TR-3 '));
        },
        pattern: /runtime_only_fixture_exercised must declare exactly TR-1, TR-2, TR-3/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => {
          const moved = manifest.trust_invariants.runtime_only_declared
            .find((entry) => entry.startsWith('TR-4 '));
          manifest.trust_invariants.runtime_only_declared =
            manifest.trust_invariants.runtime_only_declared
              .filter((entry) => entry !== moved);
          manifest.trust_invariants.runtime_only_fixture_exercised.push(moved);
        },
        pattern: /TR-4 must stay an open runtime obligation/i,
      },
      {
        file: COMPATIBILITY,
        mutate: (manifest) => {
          manifest.open_runtime_obligations = ['TR-4', 'TR-5'];
        },
        pattern: /open_runtime_obligations must be exactly TR-4, TR-5, TR-6, TR-7, TR-8/i,
      },
    ]);
  }],

  // Omission is an attack, not an absence of evidence: a manifest that simply
  // drops a verification, proof or integrity block must fail closed exactly as
  // loudly as one that states the block and lies in it.
  ['rejects omitted verification, proof, integrity and pin blocks', () => runTable([
    {
      file: COMPATIBILITY,
      mutate: (manifest) => { delete manifest.verification; },
      pattern: /verification: must be an object/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => { delete manifest.verification.test_case_counts; },
      pattern: /verification\.test_case_counts must match the independent exact counts/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => { delete manifest.proof_limits; },
      pattern: /proof_limits: must be an object/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => { delete manifest.trust_invariants; },
      pattern: /runtime_only_declared must declare exactly TR-4, TR-5, TR-6, TR-7, TR-8/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => { delete manifest.member_set_integrity; },
      pattern: /member_set_integrity: must be an object/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => { delete manifest.members; },
      pattern: /exactly 15 member hashes must verify, got 0/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => { delete manifest.source_packet; },
      pattern: /source_packet\.packet must be compatibility\//i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => { delete manifest.reused_unmodified; },
      pattern: /missing key 'reused_unmodified'/i,
    },
  ])],

  // The declared proof limits, compatibility flags and authority/idempotency/
  // receipt semantics are the packet's own non-claims. Flipping one of them, or
  // deleting the block that carries it, must not be silently accepted.
  ['rejects proof-limit, compatibility-flag and declared-semantics drift', () => runTable([
    {
      file: COMPATIBILITY,
      mutate: (manifest) => { manifest.capability_scope.side_effects = true; },
      pattern: /capability_scope must stay R0 with side_effects=false/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => { manifest.proof_limits.static_packet_integrity_proven = false; },
      pattern: /proof_limits\.static_packet_integrity_proven must be true/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => { manifest.compatibility.modifies_existing_ids = true; },
      pattern: /compatibility\.modifies_existing_ids must stay false/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => { manifest.compatibility.reuses_accepted_unmodified.pop(); },
      pattern: /reuses_accepted_unmodified must list exactly the accepted artifacts/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => { delete manifest.authority_boundaries; },
      pattern: /authority boundary must include 'Fabric tool-grant authority'/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => { delete manifest.completion_semantics; },
      pattern: /completion semantics must include 'never assert authorization_binding'/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => { delete manifest.idempotency_semantics; },
      pattern: /idempotency semantics must include 'four bound positions'/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => { delete manifest.receipt_binding; },
      pattern: /receipt binding must include 'side_effect\.performed=false'/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => { delete manifest.canonicalization; },
      pattern: /canonicalization must pin RFC 8785/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => {
        manifest.residual_questions.push('This binding is runtime verified end to end.');
      },
      pattern: /forbidden claim/i,
    },
  ])],

  // Reuse and source pins are only evidence while both ends still hold: the
  // bytes on disk and the accepted C1 manifest declaration. Drift in either
  // end, or a pin row that stops naming what it pins, fails closed.
  ['rejects reuse-declaration and accepted-C1 source-pin drift', () => runTable([
    {
      file: COMPATIBILITY,
      mutate: (manifest) => { delete manifest.reused_unmodified[0].file; },
      pattern: /reused_unmodified missing accepted artifact/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => { manifest.reused_unmodified[0].reuse = 'ported'; },
      pattern: /must declare byte-unchanged reuse/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => { manifest.source_packet.source_members.pop(); },
      pattern: /source_packet\.source_members must pin exactly 13 accepted C1 members/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => { delete manifest.source_packet.source_members[0].file; },
      pattern: /source_packet source member missing/i,
    },
    {
      // The pinned bytes still hash correctly, but the accepted C1 manifest no
      // longer declares that hash: the two ends have been split apart.
      file: SOURCE_MANIFEST,
      mutate: (manifest) => { manifest.members[0].sha256 = '7'.repeat(64); },
      pattern: /must still match the accepted C1 manifest declaration/i,
    },
    {
      file: SOURCE_MANIFEST,
      mutate: (manifest) => { delete manifest.members; },
      pattern: /the accepted C1 packet must still declare 13 members/i,
    },
    {
      file: SOURCE_MANIFEST,
      mutate: (manifest) => { manifest.canonicalization.available_result_projection.push('cache_key'); },
      pattern: /reused C1 available-result projection must match the accepted C1 declaration/i,
    },
  ])],

  ['rejects negative-semantic fixtures that stop being genuine witnesses', () => runTable([
    {
      file: IDEM_MISMATCH,
      mutate: (boundRequest) => { boundRequest.idempotency_key = 'idem-alert-context-0001'; },
      pattern: /idempotency-key-mismatch semantic fixture must differ/i,
    },
    {
      file: TENANT_MISMATCH,
      mutate: (boundRequest) => { boundRequest.tenant_id = 'tenant-acme'; },
      pattern: /tenant-mismatch semantic fixture must differ/i,
    },
    {
      file: W2F_AS_DELEGATION,
      mutate: (boundRequest) => {
        boundRequest.delegation_ref = `sha256:${'c'.repeat(64)}`;
      },
      pattern: /must be the constrained-JCS digest of the accepted W2-F delegation token/i,
    },
    {
      file: IDEM_MISMATCH,
      mutate: (boundRequest) => { boundRequest.unexpected_field = 'invalid witness'; },
      pattern: /must remain structurally valid/i,
    },
  ])],

  ['rejects bound-receipt profile violations under the deferred signature envelope', () => {
    withPacketCopy((contracts) => {
      const { validate: validateSchema } = compileBindingSchema({
        contractsRoot: contracts,
        dependencyRoot: DEPENDENCY_ROOT,
      });
      const performedCase = syntheticReceipt(contracts, { side_effect: { performed: true } });
      assert.equal(validateSchema(performedCase.receipt), false);
      const artifactCase = syntheticReceipt(contracts, {
        output_artifacts: [{
          locator: 'cybrik://fabric/artifact/0002',
          digest: `sha256:${'a'.repeat(64)}`,
        }],
      });
      assert.equal(validateSchema(artifactCase.receipt), false);
      const rolledBackCase = syntheticReceipt(contracts, { status: 'rolled_back' });
      assert.equal(validateSchema(rolledBackCase.receipt), false);
    });
    withPacketCopy((contracts) => {
      const rows = [
        [{ resolved_arguments_digest: `sha256:${'0'.repeat(64)}` },
          /resolved_arguments_digest must match the constrained-JCS resolved-arguments projection/i],
        [{ action_id: 'act-alert-context-9999' }, /receipt action_id must equal/i],
        [{ tenant_id: 'tenant-globex' }, /receipt tenant_id must equal/i],
        [{ delegation_ref: `sha256:${'9'.repeat(64)}` }, /receipt delegation_ref must equal/i],
        [{ receipt_id: 'rcpt-other' }, /receipt_id must equal the completed bound result/i],
        [{ side_effect: { performed: true, target_digest: `sha256:${'8'.repeat(64)}` } },
          /receipt side_effect\.performed must be false/i],
        [{ signature: '' }, /receipt signature reference must be present/i],
      ];
      for (const [overrides, pattern] of rows) {
        const { receipt, boundRequest, boundResult } = syntheticReceipt(contracts, overrides);
        const errors = checkBoundReceipt(receipt, boundRequest, boundResult);
        assert.match(errors.join('\n'), pattern);
      }
    });
    expectSchemaRejected(
      (schema) => {
        schema.$defs.boundReceipt.allOf[1].properties.side_effect.properties.performed = {
          type: 'boolean',
        };
      },
      /bound receipt side_effect\.performed must be exact false/i,
    );
  }],

  // `checkBoundReceipt` is an exported library entry point in its own right, so a
  // caller may hand it a bound request that never passed the packet's own fixture
  // gate. Before this guard the unguarded resolved-arguments digest threw a
  // TypeError straight out of such a call — including for a request that merely
  // omits a projected field — which crashes the caller instead of rejecting the
  // receipt binding. The rejection entry is deterministic and sanitized: it never
  // echoes the offending value or the canonicalizer's message.
  ['rejects noncanonical bound requests handed directly to the bound-receipt helper', () => {
    withPacketCopy((contracts) => {
      const { receipt, boundResult, boundRequest } = syntheticReceipt(contracts);
      const mutated = (mutate) => {
        const request = structuredClone(boundRequest);
        mutate(request);
        return request;
      };
      const rows = [
        ['non-integer number', mutated((request) => {
          request.arguments.org_scope.include_descendants = 1.5;
        })],
        ['unsafe integer', mutated((request) => {
          request.arguments.org_scope.include_descendants = 2 ** 53;
        })],
        ['NaN', mutated((request) => {
          request.arguments.org_scope.include_descendants = Number.NaN;
        })],
        ['lone surrogate', mutated((request) => { request.purpose = '\ud800'; })],
        ['omitted projected field', mutated((request) => { delete request.action_id; })],
        ['absent bound request', undefined],
      ];
      for (const [label, request] of rows) {
        let errors;
        assert.doesNotThrow(
          () => { errors = checkBoundReceipt(receipt, request, boundResult); },
          `${label} must fail closed rather than throw`,
        );
        const text = errors.join('\n');
        assert.match(text, /resolved_arguments_digest cannot be checked/i, label);
        assert.doesNotMatch(text, /1\.5|9007199254740992|NaN|lone surrogate|\ud800/, label);
      }
      // The guard narrows nothing for a canonicalizable request: a conforming
      // receipt still binds cleanly and a drifted digest is still named exactly.
      assert.deepEqual(checkBoundReceipt(receipt, boundRequest, boundResult), []);
      assert.match(
        checkBoundReceipt(
          { ...receipt, resolved_arguments_digest: `sha256:${'0'.repeat(64)}` },
          boundRequest,
          boundResult,
        ).join('\n'),
        /resolved_arguments_digest must match the constrained-JCS resolved-arguments projection/i,
      );
    });
  }],

  // A pin row is only evidence while the path it names is a real packet member.
  // Every declared `file` is proven a non-empty, relative, traversal-free
  // proposal path before it is joined to the contracts root, so an omitted,
  // retyped, escaping or directory-valued path is a fail-closed validator error.
  // Before this guard those rows reached the filesystem join and threw a
  // TypeError — or read a directory and threw EISDIR — out of the run, which
  // crashes the evidence rather than rejecting the manifest.
  ['rejects member paths that are missing, non-string, unsafe or not a file', () => runTable([
    {
      file: COMPATIBILITY,
      mutate: (manifest) => { delete manifest.members[0].file; },
      pattern: /compatibility member file must be a string, got undefined/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => { manifest.members[0].file = 42; },
      pattern: /compatibility member file must be a string, got number/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => { manifest.members[0].file = ''; },
      pattern: /compatibility member file must be a non-empty string/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => { manifest.members[0].file = '../../etc/passwd'; },
      pattern: /compatibility member file must be a safe relative proposal path/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => { manifest.members[0].file = '/etc/passwd'; },
      pattern: /compatibility member file must be a safe relative proposal path/i,
    },
    {
      // Safe and relative, but not a declared member of this packet.
      file: COMPATIBILITY,
      mutate: (manifest) => { manifest.members[0].file = 'json-schema'; },
      pattern: /compatibility member outside the exact declared member allowlist/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => { manifest.reused_unmodified[0].file = 7; },
      pattern: /reused_unmodified missing accepted artifact: declared file must be a string/i,
    },
    {
      // A directory has no pinnable bytes: refused before the read.
      file: COMPATIBILITY,
      mutate: (manifest) => { manifest.reused_unmodified[0].file = 'json-schema'; },
      pattern: /reused_unmodified missing accepted artifact: json-schema/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => {
        manifest.source_packet.source_members[0].file = '../../../etc/hosts';
      },
      pattern: /source_packet source member missing: declared file must be a safe relative/i,
    },
    {
      file: COMPATIBILITY,
      mutate: (manifest) => { manifest.source_packet.source_members[0].file = 'json-schema'; },
      pattern: /source_packet source member missing: json-schema/i,
    },
  ])],

  ['rejects values outside the declared constrained-JCS value set', () => {
    assert.throws(() => canonicalizeJcs({ ratio: 1.5 }), /constrained JCS violation/);
    assert.throws(() => canonicalizeJcs({ big: 2 ** 53 }), /constrained JCS violation/);
    assert.throws(() => canonicalizeJcs({ nan: Number.NaN }), /constrained JCS violation/);
    assert.throws(() => canonicalizeJcs({ lone: '\ud800' }), /constrained JCS violation/);
    assert.throws(() => canonicalizeJcs({ when: undefined }), /constrained JCS violation/);
    runTable([
      {
        file: REQUEST,
        mutate: (boundRequest) => { boundRequest.arguments.org_scope.include_descendants = 1.5; },
        pattern: /constrained JCS violation/i,
      },
    ]);
  }],
];

// ---------------------------------------------------------------------------
// 3 positive checks
// ---------------------------------------------------------------------------

const POSITIVE_CASES = [
  ['current packet is closed, coherently ACCEPTED FOR IMPLEMENTATION, and valid', () => {
    withPacketCopy((contracts) => {
      const result = validate(contracts);
      assert.equal(result.ok, true, result.errors.join('\n'));
      assert.equal(result.status, ACCEPTED_STATUS_TOKEN);
      assert.equal(result.implementationStatus, 'NOT IMPLEMENTED');
      assert.equal(result.acceptedForImplementation, true);
      assert.equal(result.acceptedOn, ACCEPTED_ON);
      assert.equal(result.runtimeAuthorizationProven, false);
      assert.equal(result.killSwitchRuntimeProven, false);
      assert.deepEqual(result.counts, {
        schemas_compiled: 1,
        positive_total: 4,
        positive_pass: 4,
        negative_schema_total: 6,
        negative_schema_reject: 6,
        negative_semantic_total: 3,
        negative_semantic_structurally_valid: 3,
        bound_result_correlations_verified: 3,
        business_request_conformance_verified: 2,
        business_request_reconstructions_verified: 2,
        // Every fixture carrying an inline output digest is re-derived, not just
        // the positive ones: 5 fixtures declare output.output_digest and 3 of
        // those carry the available business outcome.
        bound_output_digests_verified: 5,
        business_context_digests_verified: 3,
        reused_pins_verified: 8,
        source_member_pins_verified: 13,
        manifest_member_hashes_verified: 15,
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

    // Every negative fixture cites a canonical label that is really declared.
    const declared = new Set([
      ...manifest.trust_invariants.structural,
      ...manifest.trust_invariants.runtime_only_fixture_exercised,
    ].map((entry) => /^(TB-\d+|TR-\d+)\s/.exec(entry)?.[1]));
    const examples = readJson(join(SOURCE_CONTRACTS, EXAMPLES_MANIFEST)).examples;
    for (const [file, label] of Object.entries(EXPECTED_TRUST_INVARIANTS)) {
      const row = examples.find((entry) => entry.file === file);
      assert.match(row.invariant, new RegExp(`^${label} `), `${file} must cite ${label}`);
      assert.equal(declared.has(label), true, `${label} must exist in trust_invariants`);
    }

    assert.equal(manifest.member_set_integrity.member_count, manifest.members.length);
    assert.equal(
      manifest.member_set_integrity.member_set_digest,
      memberSetDigest(manifest.members),
    );

    // The lifecycle is accepted and coherent across all three lifecycle
    // documents, and the acceptance is bounded: implementation, transport, CI,
    // Bundle, release and every runtime proof stay unclaimed.
    const schemaDocument = readJson(join(SOURCE_CONTRACTS, SCHEMA));
    const examplesManifest = readJson(join(SOURCE_CONTRACTS, EXAMPLES_MANIFEST));
    for (const document of [manifest, schemaDocument, examplesManifest]) {
      assert.equal(document['x-cybrik-status'], 'ACCEPTED FOR IMPLEMENTATION');
      assert.equal(document['x-cybrik-not-accepted'], false);
      assert.equal(document['x-cybrik-contract-version'], '0.1.0');
      // No stale proposal lifecycle assertion survives the flip.
      assert.doesNotMatch(
        JSON.stringify(document),
        /\bPROPOSED\b|\bNOT ACCEPTED\b|proposal-only|records no acceptance/,
      );
    }
    assert.equal(manifest['x-cybrik-is-bundle-tag'], false);
    assert.equal(manifest['x-cybrik-packet-version'], '0.1.0');
    assert.equal(manifest.acceptance.status, 'ACCEPTED FOR IMPLEMENTATION');
    assert.equal(manifest.acceptance.accepted_on, ACCEPTED_ON);
    assert.ok(manifest.acceptance.decision_record.includes(GATE_DOC));
    assert.deepEqual(manifest.acceptance.non_claims, EXPECTED_NON_CLAIMS);
    assert.ok(manifest.acceptance.settled_checklist.length > 0);
    assert.deepEqual(manifest.acceptance.open_runtime_obligations, OPEN_RUNTIME_OBLIGATIONS);
    assert.equal(manifest.proof_limits.accepted_for_implementation, true);
    assert.equal(manifest.proof_limits.endpoint_or_transport_implemented, false);
    assert.equal(manifest.proof_limits.runtime_authorization_proven, false);
    assert.equal(manifest.proof_limits.policy_completion_runtime_proven, false);
    assert.equal(manifest.proof_limits.kill_switch_runtime_proven, false);
    assert.equal(manifest.proof_limits.release_ready, false);
    assert.equal(manifest.capability_scope.implementation_status, 'NOT IMPLEMENTED');
    assert.match(manifest.verification.ci_wiring, /^NOT WIRED\./);
    assert.deepEqual(manifest.open_runtime_obligations, OPEN_RUNTIME_OBLIGATIONS);

    // The reused W2-B envelope, C1 source packet and W2-F witness anchor are
    // pinned to the bytes actually on disk, so this packet cannot drift from the
    // accepted contracts it reuses byte-unchanged.
    for (const entry of manifest.reused_unmodified) {
      assert.equal(
        entry.sha256,
        sha256(readFileSync(join(SOURCE_CONTRACTS, entry.file))),
        `${entry.file} must be reused byte-unchanged`,
      );
    }
    const sourceManifest = readJson(join(SOURCE_CONTRACTS, SOURCE_MANIFEST));
    assert.equal(
      manifest.source_packet.source_member_set_digest,
      sourceManifest.member_set_integrity.member_set_digest,
    );
    assert.equal(manifest.source_packet.source_member_count, sourceManifest.members.length);

    // The transport binding is lossless: the reconstructed business request is
    // byte-identical to the accepted C1 request fixture under constrained JCS.
    const boundRequest = readJson(join(SOURCE_CONTRACTS, REQUEST));
    const boundResult = readJson(join(SOURCE_CONTRACTS, AVAILABLE));
    const reconstructed = reconstructBusinessRequest(
      boundRequest,
      boundResult.output.data.authorization_binding,
    );
    assert.equal(
      canonicalizeJcs(reconstructed),
      canonicalizeJcs(readJson(join(SOURCE_CONTRACTS, SOURCE_REQUEST))),
    );

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

  ['accepts the idempotency-conflict business outcome inside envelope completed', () => {
    withPacketCopy((contracts) => {
      mutateJson(contracts, UNAVAILABLE, (boundResult) => {
        boundResult.output.data.outcome = 'idempotency_conflict';
        boundResult.output.data.idempotency_disposition = 'conflict';
        boundResult.output.data.failure.code = 'idempotency_binding_conflict';
        refreshOutputDigest(boundResult);
      });
      const result = validate(contracts);
      // The business bytes deliberately no longer equal the accepted C1
      // unavailable fixture, so only that single equality check may fail.
      assert.deepEqual(
        result.errors.filter((error) => !/byte-identical to the accepted C1 result/i.test(error)),
        [],
      );
    });
    withPacketCopy((contracts) => {
      const { validate: validateSchema } = compileBindingSchema({
        contractsRoot: contracts,
        dependencyRoot: DEPENDENCY_ROOT,
      });
      const boundResult = readJson(join(contracts, UNAVAILABLE));
      boundResult.output.data.outcome = 'idempotency_conflict';
      boundResult.output.data.idempotency_disposition = 'conflict';
      boundResult.output.data.failure.code = 'idempotency_binding_conflict';
      refreshOutputDigest(boundResult);
      assert.equal(validateSchema(boundResult), true);
    });
  }],

  ['accepts a conforming bound receipt with a deferred signature reference', () => {
    withPacketCopy((contracts) => {
      const { validate: validateSchema } = compileBindingSchema({
        contractsRoot: contracts,
        dependencyRoot: DEPENDENCY_ROOT,
      });
      const { receipt, boundRequest, boundResult } = syntheticReceipt(contracts);
      assert.equal(validateSchema(receipt), true);
      assert.deepEqual(checkBoundReceipt(receipt, boundRequest, boundResult), []);
      assert.equal(
        receipt.resolved_arguments_digest,
        resolvedArgumentsDigest(boundRequest),
      );
      // The signature stays an opaque reference to the deferred signing
      // envelope; this packet invents no signature format.
      assert.equal(typeof receipt.signature, 'string');
      assert.equal(receipt.side_effect.performed, false);
    });
  }],
];

for (const [name, run] of REJECTION_CASES) test(name, run);
for (const [name, run] of POSITIVE_CASES) test(name, run);
