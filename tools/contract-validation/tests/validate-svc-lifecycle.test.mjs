import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

test('the exact lifecycle-delegation proposal is coherent but remains unaccepted', async () => {
  const report = await validateSvcLifecycleBinding({ root: ROOT });
  assert.deepEqual(report.errors, []);
  assert.equal(report.status, 'PROPOSED');
  assert.equal(report.notAccepted, true);
  assert.equal(report.counts.packetFiles, expectedPacketPaths.length);
  assert.equal(report.counts.positiveFixtures, 4);
  assert.equal(report.counts.negativeSemanticFixtures, 10);
});

test('a lifecycle or acceptance half-flip fails closed', async () => {
  const path =
    'contracts/compatibility/cybrik-suite-investigation-lifecycle-svc-delegation-proposal.v1.manifest.json';
  const report = await validateSvcLifecycleBinding({
    root: ROOT,
    overrides: mutateJson(path, (manifest) => {
      manifest['x-cybrik-status'] = 'ACCEPTED FOR IMPLEMENTATION';
      manifest['x-cybrik-not-accepted'] = false;
      manifest['x-cybrik-implemented'] = true;
    }),
  });
  assert.ok(report.errors.some((error) => error.includes(
    'must remain PROPOSED / NOT ACCEPTED / NOT IMPLEMENTED',
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
  assert.match(notes, /current Cyber AI implementation.*unconditional refusal/is);
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
