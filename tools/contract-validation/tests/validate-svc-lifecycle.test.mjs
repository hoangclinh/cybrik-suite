import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  expectedPacketPaths,
  validateSvcLifecycleBinding,
} from '../validate-svc-lifecycle.mjs';

const ROOT = resolve(import.meta.dirname, '../../..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const mutateJson = (path, mutate) => {
  const value = JSON.parse(read(path));
  mutate(value);
  return new Map([[path, `${JSON.stringify(value, null, 2)}\n`]]);
};
const mutatedJsonEntry = (path, mutate) => {
  const value = JSON.parse(read(path));
  mutate(value);
  return [path, `${JSON.stringify(value, null, 2)}\n`];
};

test('the exact lifecycle-delegation binding is accepted for implementation only', async () => {
  const report = await validateSvcLifecycleBinding({ root: ROOT });
  assert.deepEqual(report.errors, []);
  assert.equal(report.status, 'ACCEPTED FOR IMPLEMENTATION');
  assert.equal(report.notAccepted, false);
  assert.equal(report.counts.packetFiles, expectedPacketPaths.length);
  assert.equal(report.counts.positiveFixtures, 4);
  assert.equal(report.counts.negativeSemanticFixtures, 10);

  const manifest = JSON.parse(read(
    'contracts/compatibility/cybrik-suite-investigation-lifecycle-svc-delegation-proposal.v1.manifest.json',
  ));
  assert.equal(manifest.gate.status, 'ACCEPTED FOR IMPLEMENTATION');
  assert.equal(manifest.acceptance.status, 'ACCEPTED FOR IMPLEMENTATION');
  assert.equal(manifest.acceptance.implementation, 'NOT IMPLEMENTED');
  assert.equal(manifest.acceptance.decided_on, '2026-07-31');
  assert.match(manifest.acceptance.decided_by, /Founder-delegated technical authority/);
  assert.equal(manifest['x-cybrik-is-bundle-tag'], false);
  assert.deepEqual(manifest.non_delegatable_operations, [
    'investigation.checkpoint',
    'investigation.bundle_read',
  ]);
});

test('a lifecycle or acceptance half-flip fails closed', async () => {
  const path =
    'contracts/compatibility/cybrik-suite-investigation-lifecycle-svc-delegation-proposal.v1.manifest.json';
  const report = await validateSvcLifecycleBinding({
    root: ROOT,
    overrides: mutateJson(path, (manifest) => {
      manifest['x-cybrik-status'] = 'PROPOSED';
      manifest['x-cybrik-not-accepted'] = true;
      manifest.acceptance.status = 'NOT ACCEPTED';
    }),
  });
  assert.ok(report.errors.some((error) => error.includes(
    'must remain ACCEPTED FOR IMPLEMENTATION / NOT IMPLEMENTED',
  )));
});

test('audience and exact operation-to-scope mappings fail closed on drift', async () => {
  const path =
    'contracts/compatibility/cybrik-suite-investigation-lifecycle-svc-delegation-proposal.v1.manifest.json';
  const report = await validateSvcLifecycleBinding({
    root: ROOT,
    overrides: mutateJson(path, (manifest) => {
      manifest.audience = 'svc:cyber-ai-inference';
      manifest.delegatable_operations['investigation.status'] =
        'investigation.lifecycle:create';
    }),
  });
  assert.ok(report.errors.some((error) => error.includes('manifest audience')));
  assert.ok(report.errors.some((error) => error.includes('operation-to-scope map')));
});

test('checkpoint and bundle-read cannot become externally delegatable', async () => {
  const path =
    'contracts/compatibility/cybrik-suite-investigation-lifecycle-svc-delegation-proposal.v1.manifest.json';
  const report = await validateSvcLifecycleBinding({
    root: ROOT,
    overrides: mutateJson(path, (manifest) => {
      manifest.delegatable_operations['investigation.checkpoint'] =
        'investigation.lifecycle:write';
      manifest.delegatable_operations['investigation.bundle_read'] =
        'investigation.lifecycle:read';
      manifest.delegation_disposition.readInvestigationBundle.mint_token = true;
    }),
  });
  assert.ok(report.errors.some((error) => error.includes('operation-to-scope map')));
  assert.ok(report.errors.some((error) => error.includes(
    'readInvestigationBundle must not mint or consume',
  )));
});

test('listInvestigationCheckpoints stays a status/read operation', async () => {
  const path =
    'contracts/compatibility/cybrik-suite-investigation-lifecycle-svc-delegation-proposal.v1.manifest.json';
  const report = await validateSvcLifecycleBinding({
    root: ROOT,
    overrides: mutateJson(path, (manifest) => {
      manifest.business_operation_binding.listInvestigationCheckpoints =
        'investigation.checkpoint';
    }),
  });
  assert.ok(report.errors.some((error) => error.includes(
    'listInvestigationCheckpoints must bind',
  )));
});

test('every semantic negative fixture must embody its named rejection', async () => {
  const path = 'contracts/examples/svc-lifecycle/negative-semantic/'
    + 'svc-lifecycle-request.scope-mismatch.json';
  const report = await validateSvcLifecycleBinding({
    root: ROOT,
    overrides: mutateJson(path, (request) => {
      request.presented_token.claims.scope =
        'investigation.lifecycle:create';
    }),
  });
  assert.ok(report.errors.some((error) => error.includes(
    'fixture must exercise SCOPE',
  )));
});

test('positive requests fail closed on replay, marking, identity and mTLS drift', async () => {
  const path =
    'contracts/examples/svc-lifecycle/positive/svc-lifecycle-create-request.json';
  const report = await validateSvcLifecycleBinding({
    root: ROOT,
    overrides: mutateJson(path, (request) => {
      request.tenant_id = 'tenant-other';
      request.relying_party.peer_cert_thumbprint =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq';
    }),
  });
  assert.ok(report.errors.some((error) => error.includes('TENANT')));
  assert.ok(report.errors.some((error) => error.includes('CNF_MTLS')));
});

test('accepted bundle-read business contract remains source truth while delegation is declined', async () => {
  const report = await validateSvcLifecycleBinding({ root: ROOT });
  assert.deepEqual(report.errors, []);
  assert.equal(report.counts.acceptedLifecycleOperations, 5);
  assert.equal(report.counts.acceptedBundleRead200Responses, 1);

  const notes = read(
    'contracts/adapters/cybrik-svc-lifecycle-delegation-mapping-notes.v1.md',
  );
  assert.match(notes, /readInvestigationBundle.*accepted business lifecycle operation/is);
  assert.doesNotMatch(notes, /reserved for a future separately accepted profile/i);
  assert.match(notes, /no caller may mint.*no relying party may consume/is);
});

test('accepted lifecycle operation and 200-response source drift fails closed', async () => {
  const lifecycleManifestPath =
    'contracts/compatibility/cybrik-suite-investigation-lifecycle-proposal.v1.manifest.json';
  const lifecycleManifest = JSON.parse(read(lifecycleManifestPath));
  lifecycleManifest.operation_contract.operations =
    lifecycleManifest.operation_contract.operations.filter(
      (operation) => operation !== 'readInvestigationBundle',
    );

  const openApiPath =
    'contracts/openapi/cybrik-ai-investigation-lifecycle-proposal.v1.openapi.yaml';
  const openApi = read(openApiPath).replace(
    "        '200':\n          description: Authorized immutable bundle view.",
    "        '201':\n          description: Authorized immutable bundle view.",
  );
  const report = await validateSvcLifecycleBinding({
    root: ROOT,
    overrides: new Map([
      [lifecycleManifestPath, `${JSON.stringify(lifecycleManifest, null, 2)}\n`],
      [openApiPath, openApi],
    ]),
  });

  assert.ok(report.errors.some((error) => error.includes(
    'accepted lifecycle operation set must include readInvestigationBundle',
  )));
  assert.ok(report.errors.some((error) => error.includes(
    'accepted readInvestigationBundle must retain its declared 200 response',
  )));
});

test('bundle-read nondelegation is a Suite contract rule with no cross-repo runtime claim', async () => {
  const report = await validateSvcLifecycleBinding({ root: ROOT });
  assert.deepEqual(report.errors, []);

  const manifest = JSON.parse(read(
    'contracts/compatibility/cybrik-suite-investigation-lifecycle-svc-delegation-proposal.v1.manifest.json',
  ));
  const disposition = manifest.delegation_disposition.readInvestigationBundle;
  assert.equal(
    disposition.reason,
    'ACCEPTED_BINDING_GRANTS_NO_BUNDLE_READ_DELEGATION_AUTHORITY',
  );
  assert.equal(disposition.delegated, false);
  assert.equal(disposition.mint_token, false);
  assert.equal(disposition.consume_token, false);
  assert.equal(
    disposition.future_binding_gate,
    'SEPARATELY_ACCEPTED_IMPLEMENTATION_AND_CONTRACT_GATE_REQUIRED',
  );

  const proposalProse = [
    read('contracts/README.md'),
    read('contracts/compatibility/README.md'),
    read('contracts/adapters/cybrik-svc-lifecycle-delegation-mapping-notes.v1.md'),
    read('contracts/examples/svc-lifecycle/examples-manifest.json'),
    JSON.stringify(manifest),
  ].join('\n');
  assert.doesNotMatch(
    proposalProse,
    /\bCyber AI\b.{0,80}\b(?:currently|runtime (?:returns|refuses))\b/is,
  );
  assert.match(proposalProse, /no caller may mint/i);
  assert.match(proposalProse, /no relying party may consume/i);
});

test('cross-repo runtime-state overclaim and weakened future gate fail closed', async () => {
  const notesPath =
    'contracts/adapters/cybrik-svc-lifecycle-delegation-mapping-notes.v1.md';
  const manifestPath =
    'contracts/compatibility/cybrik-suite-investigation-lifecycle-svc-delegation-proposal.v1.manifest.json';
  const manifest = JSON.parse(read(manifestPath));
  manifest.delegation_disposition.readInvestigationBundle.future_binding_gate =
    'RUNTIME_CHANGE_ONLY';
  const notes = `${read(notesPath)}\nCyber AI currently refuses bundle-read requests at runtime.\n`;

  const report = await validateSvcLifecycleBinding({
    root: ROOT,
    overrides: new Map([
      [manifestPath, `${JSON.stringify(manifest, null, 2)}\n`],
      [notesPath, notes],
    ]),
  });
  assert.ok(report.errors.some((error) => error.includes(
    'proposal must not assert cross-repository runtime state',
  )));
  assert.ok(report.errors.some((error) => error.includes(
    'future bundle-read binding requires a separately accepted implementation and contract gate',
  )));
});

test('canonical npm validate directly executes the lifecycle-delegation test suite', () => {
  const orchestrator = read('tools/contract-validation/validate.mjs');
  const packageJson = JSON.parse(read('tools/contract-validation/package.json'));
  assert.equal(packageJson.scripts.validate, 'node validate.mjs');
  assert.match(
    orchestrator,
    /['"]tests\/validate-svc-lifecycle\.test\.mjs['"]/,
  );
  const w1Inventory = orchestrator.slice(
    orchestrator.indexOf('const W1_CONTRACT_TEST_FILES'),
    orchestrator.indexOf('const W1_CONTRACT_TEST_COUNT'),
  );
  assert.doesNotMatch(
    w1Inventory,
    /validate-svc-lifecycle\.test\.mjs/,
    'the additive suite must not change the accepted W1 98-test inventory',
  );
});

test('runtime-overclaim detector is bundle-read specific and ignores unrelated Cyber AI prose', async () => {
  const readmePath = 'contracts/README.md';
  const unrelated = `${read(readmePath)}

Cyber AI returns model metadata for inference compatibility checks; this sentence makes no
bundle-read runtime-state assertion and grants no authority.
`;
  const report = await validateSvcLifecycleBinding({
    root: ROOT,
    overrides: new Map([[readmePath, unrelated]]),
  });
  assert.deepEqual(report.errors, []);
});

test('both previously reviewed bundle-read runtime overclaims remain rejected', async () => {
  const notesPath =
    'contracts/adapters/cybrik-svc-lifecycle-delegation-mapping-notes.v1.md';
  const reviewedOverclaims = [
    'For bundle-read, the current Cyber AI implementation remains unconditional refusal.',
    'Cyber AI currently refuses bundle-read requests at runtime.',
  ];
  for (const overclaim of reviewedOverclaims) {
    const report = await validateSvcLifecycleBinding({
      root: ROOT,
      overrides: new Map([[notesPath, `${read(notesPath)}\n${overclaim}\n`]]),
    });
    assert.ok(
      report.errors.some((error) => error.includes(
        'proposal must not assert cross-repository runtime state',
      )),
      overclaim,
    );
  }
});

test('a missing packet root fails closed before dependency or fixture validation', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'cybrik-svc-lifecycle-missing-'));
  try {
    const report = await validateSvcLifecycleBinding({ root });
    assert.equal(report.status, 'UNKNOWN');
    assert.equal(report.notAccepted, undefined);
    assert.equal(report.counts.packetFiles, 0);
    assert.equal(report.errors.length, expectedPacketPaths.length);
    assert.ok(report.errors.every((error) => error.startsWith(
      'missing required lifecycle-delegation packet file:',
    )));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('accepted lifecycle source status, version, and OpenAPI response drift fail closed', async () => {
  const lifecyclePath =
    'contracts/compatibility/cybrik-suite-investigation-lifecycle-proposal.v1.manifest.json';
  const openApiPath =
    'contracts/openapi/cybrik-ai-investigation-lifecycle-proposal.v1.openapi.yaml';
  const report = await validateSvcLifecycleBinding({
    root: ROOT,
    overrides: new Map([
      mutatedJsonEntry(lifecyclePath, (manifest) => {
        manifest['x-cybrik-status'] = 'PROPOSED';
        manifest.supersession_mapping.accepted_successor.contract_version = '0.1.0';
      }),
      [openApiPath, read(openApiPath).replace(
        /^\s{6}operationId:\s*readInvestigationBundle\s*$/m,
        '      operationId: removedBundleRead',
      )],
    ]),
  });
  assert.ok(report.errors.some((error) => error.includes(
    'accepted lifecycle source must remain ACCEPTED FOR IMPLEMENTATION',
  )));
  assert.ok(report.errors.some((error) => error.includes(
    'accepted readInvestigationBundle must retain its declared 200 response',
  )));
  assert.ok(report.errors.some((error) => error.includes(
    'accepted lifecycle source must retain v0.1.1',
  )));
});

test('packet identity, acceptance metadata, and nondelegation inventory drift fail closed', async () => {
  const path =
    'contracts/compatibility/cybrik-suite-investigation-lifecycle-svc-delegation-proposal.v1.manifest.json';
  const report = await validateSvcLifecycleBinding({
    root: ROOT,
    overrides: mutateJson(path, (manifest) => {
      manifest['x-cybrik-packet-version'] = '1.0.0';
      manifest['x-cybrik-is-bundle-tag'] = true;
      manifest.non_delegatable_operations = ['investigation.checkpoint'];
      manifest.accepted_source_cross_check.response_profile = 'drifted';
      manifest.acceptance.decided_on = '2099-01-01';
    }),
  });
  for (const expected of [
    'must remain v0.1.0 and not a bundle tag',
    'non-delegatable operation inventory must remain exact',
    'accepted-source cross-check must distinguish',
    'accepted lifecycle-delegation metadata must remain complete and exact',
  ]) {
    assert.ok(report.errors.some((error) => error.includes(expected)), expected);
  }
});

test('mapping notes and accepted README lifecycle language are mandatory', async () => {
  const notesPath =
    'contracts/adapters/cybrik-svc-lifecycle-delegation-mapping-notes.v1.md';
  const report = await validateSvcLifecycleBinding({
    root: ROOT,
    overrides: new Map([
      [notesPath, read(notesPath).replace('ACCEPTED FOR IMPLEMENTATION', 'status omitted')],
      ['contracts/README.md', read('contracts/README.md').replace(
        'W2-F-LIFECYCLE-BINDING, 2026-07-31',
        'lifecycle gate omitted',
      )],
      [
        'docs/releases/GATE-W2-F-LIFECYCLE-DELEGATION-ACCEPTANCE-2026-07-31.md',
        '# decision record omitted\n',
      ],
    ]),
  });
  assert.ok(report.errors.some((error) => error.includes(
    "mapping notes must state 'ACCEPTED FOR IMPLEMENTATION'",
  )));
  assert.ok(report.errors.some((error) => error.includes(
    'manifest member sha256 mismatch for adapters/',
  )));
  assert.ok(report.errors.some((error) => error.includes(
    'contracts/README.md: accepted lifecycle-delegation status and gate must remain explicit',
  )));
  assert.ok(report.errors.some((error) => error.includes(
    "decision record must state 'Founder-delegated technical authority'",
  )));
});

test('member inventory, member digest, and accepted-source ownership drift fail closed', async () => {
  const path =
    'contracts/compatibility/cybrik-suite-investigation-lifecycle-svc-delegation-proposal.v1.manifest.json';
  const report = await validateSvcLifecycleBinding({
    root: ROOT,
    overrides: mutateJson(path, (manifest) => {
      manifest.members.pop();
      manifest.members[0].sha256 = '0'.repeat(64);
      manifest.members.push({
        file: manifest.reuses_accepted_unmodified[0],
        kind: 'invalid-overlap',
        contract_version: '0.1.0',
        sha256: '0'.repeat(64),
      });
      manifest.members.push({ ...manifest.members[0] });
    }),
  });
  assert.ok(report.errors.some((error) => error.includes(
    'manifest member inventory must contain each non-manifest packet file exactly once',
  )));
  assert.ok(report.errors.some((error) => error.includes('manifest member inventory missing')));
  assert.ok(report.errors.some((error) => error.includes('manifest member sha256 mismatch')));
  assert.ok(report.errors.some((error) => error.includes(
    'reused accepted member must not also be owned by proposal',
  )));
});

test('examples inventory and trust metadata drift fail closed without hiding fixture checks', async () => {
  const examplesPath = 'contracts/examples/svc-lifecycle/examples-manifest.json';
  const trustPath =
    'contracts/examples/svc-lifecycle/positive/svc-lifecycle-trust-metadata.json';
  const report = await validateSvcLifecycleBinding({
    root: ROOT,
    overrides: new Map([
      mutatedJsonEntry(examplesPath, (manifest) => {
        manifest.test_reference_clock_epoch_seconds = 0;
        manifest.examples = manifest.examples.filter(
          (row) => row.file !== 'positive/svc-lifecycle-cancel-request.json',
        );
      }),
      mutatedJsonEntry(trustPath, (trust) => {
        trust.self_audience = 'svc:wrong';
        trust.max_token_ttl_seconds = 121;
        trust.require_cnf = false;
      }),
    ]),
  });
  assert.ok(report.errors.some((error) => error.includes(
    'examples manifest lifecycle or reference clock is invalid',
  )));
  assert.ok(report.errors.some((error) => error.includes(
    'examples manifest fixture count mismatch',
  )));
  assert.ok(report.errors.some((error) => error.includes(
    'examples manifest missing fixture positive/svc-lifecycle-cancel-request.json',
  )));
  assert.ok(report.errors.some((error) => error.includes(
    'positive trust metadata must pin lifecycle audience, cnf, mTLS and 120s TTL',
  )));
});

test('positive request rejects untrusted issuer, trust domain, time, and malformed token shape', async () => {
  const path =
    'contracts/examples/svc-lifecycle/positive/svc-lifecycle-create-request.json';
  const report = await validateSvcLifecycleBinding({
    root: ROOT,
    overrides: mutateJson(path, (request) => {
      request.relying_party.trust_domain = 'wrong.example';
      request.presented_token.claims.iss = 'https://untrusted.example';
      request.presented_token.claims.exp = 1900000201;
      request.presented_token.header.typ = 'JWT';
      request.presented_token.header.alg = 'HS256';
      delete request.presented_token.header.kid;
      request.presented_token.claims.jti = 'short';
    }),
  });
  const joined = report.errors.join('\n');
  assert.match(joined, /positive fixture violations:.*TRUST_DOMAIN/);
  assert.match(joined, /positive fixture violations:.*PINNED_TRUST/);
  assert.match(joined, /positive fixture violations:.*TIME/);
  assert.match(joined, /token typ must be at\+jwt/);
  assert.match(joined, /token alg must be asymmetric/);
  assert.match(joined, /token kid required/);
  assert.match(joined, /token jti too short/);
});
