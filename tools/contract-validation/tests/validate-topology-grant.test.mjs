import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
const MODULE_PATH = join(ROOT, 'tools/contract-validation/validate-topology-grant.mjs');
const SCHEMA_PATH = join(ROOT, 'docs/uat/topology-rehearsal-grant.schema.json');
const RECORD_SCHEMA_PATH = join(ROOT, 'docs/uat/topology-rehearsal.schema.json');
const RECORD_PATH = join(
  ROOT,
  'docs/uat/topology-rehearsals/postgres-loopback-internal-v1-r1/topology-rehearsal.json',
);
const TOPOLOGY_VALIDATOR_PATH = join(
  ROOT,
  'tools/contract-validation/validate-topology-rehearsal.mjs',
);
const VALIDATE_PATH = join(ROOT, 'tools/contract-validation/validate.mjs');
const PACKAGE_PATH = join(ROOT, 'tools/contract-validation/package.json');
const READMES = [
  join(ROOT, 'docs/uat/topology-rehearsals/README.md'),
  join(ROOT, 'tools/contract-validation/README.md'),
];

const GRANT_KEYS = [
  'schema',
  'record',
  'runner',
  'topology',
  'selected_image_identity',
  'observed_image_identity',
  'repositories',
  'tools',
  'window',
  'attempt',
  'authorizes',
  'grants_no_authority',
];
const TEST_DIGEST = (digit) => digit.repeat(64);
const TEST_SHA = (digit) => `sha256:${TEST_DIGEST(digit)}`;

const NOW = '2026-08-05T00:01:00Z';
// The one exact proposed prior-state record digest a grant record binding may name. It is
// supplied by the caller from the policy state history, never derived from the grant, and it
// is never the current authorized record's own digest.
const PINNED_PROPOSED_RECORD_SHA256 = TEST_DIGEST('1');
const options = (overrides = {}) => ({
  now: NOW,
  pinnedProposedRecordSha256: PINNED_PROPOSED_RECORD_SHA256,
  ...overrides,
});

// Exact finding texts. The record-binding finding is distinct from the record path/digest
// shape finding, so an unpinned binding and a malformed record block name different causes.
const RECORD_SHAPE_FINDING =
  'grant record binding must name the pinned topology record path and its 64-hex digest';
const RECORD_BINDING_FINDING =
  'grant record binding must name the exact pinned proposed prior-state record digest';

function grant(overrides = {}) {
  const value = {
    schema: 'CYBRIK-TOPOLOGY-REHEARSAL-GRANT/v1',
    record: {
      path: 'docs/uat/topology-rehearsals/postgres-loopback-internal-v1-r1/topology-rehearsal.json',
      sha256: TEST_DIGEST('1'),
    },
    runner: { aggregate_sha256: TEST_DIGEST('2') },
    topology: {
      host_ip: '127.0.0.1',
      host_port: 15433,
      container_port: 5432,
      protocol: 'tcp',
      internal_network: true,
      publish_spec: '127.0.0.1:15433:5432/tcp',
    },
    selected_image_identity: {
      repository: 'postgres',
      tag: '16-alpine',
      platform: { os: 'linux', architecture: 'arm64', variant: null },
      index_digest: TEST_SHA('3'),
      manifest_digest: TEST_SHA('4'),
      pull_policy: 'never',
    },
    observed_image_identity: {
      repository: 'postgres',
      tag: '16-alpine',
      platform: { os: 'linux', architecture: 'arm64', variant: null },
      index_digest: TEST_SHA('3'),
      manifest_digest: TEST_SHA('4'),
      local_image_id: TEST_SHA('5'),
      observed_at: '2026-08-05T00:00:00Z',
    },
    repositories: Object.fromEntries(
      ['cybrik-suite', 'cybrik-soc-command-center', 'cybrik-cyber-ai-platform', 'cybrik-security-tool-fabric']
        .map((name, index) => [name, {
          commit: String(index + 6).repeat(40),
          tree: ['a', 'b', 'c', 'd'][index].repeat(40),
          clean: true,
        }]),
    ),
    tools: {
      docker: { path: '/usr/local/bin/docker', sha256: TEST_DIGEST('b'), version: '29.6.2' },
      probe: {
        path: '/usr/bin/nc',
        sha256: '427423db6d5d5e9f720c5e110a2c9b3cba39ea089dafed4ab936d04dd218bdac',
        argv: ['-z', '-w', '5', '127.0.0.1', '15433'],
      },
    },
    window: {
      not_before: '2026-08-05T00:00:00Z',
      expires_at: '2026-08-05T00:03:00Z',
      runtime_limit_seconds: 180,
      extension_cycles: 0,
    },
    attempt: { ordinal: 1, max_attempts: 1 },
    authorizes: 'topology_rehearsal_single_attempt',
    grants_no_authority: {
      demo: true,
      merge: true,
      product_runtime: true,
      production: true,
      release: true,
      uat: true,
    },
  };
  return Object.assign(value, overrides);
}

function canonicalBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function implementation() {
  assert.ok(existsSync(MODULE_PATH), 'validate-topology-grant.mjs is not implemented (C8)');
  return import(`${pathToFileURL(MODULE_PATH).href}?red=${Date.now()}-${Math.random()}`);
}

test('T1 C8 topology grant validator exports its bounded semantic surface', async () => {
  const module = await implementation();
  assert.deepEqual(
    Object.keys(module).sort(),
    [
      'GRANT_KEYS',
      'GRANT_SCHEMA_PATH',
      'GRANT_SIGNATURE_FINDING',
      'canonicalGrantBytes',
      'validateGrantBeforeSignature',
      'validateGrantBytes',
      'validateGrantDocument',
    ].sort(),
  );
});

test('T2 the grant schema exists and pins the exact ordered top-level inventory', () => {
  assert.ok(existsSync(SCHEMA_PATH), 'topology-rehearsal-grant.schema.json is absent (C8)');
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
  assert.equal(schema.$id, 'https://contracts.cybrik.example/docs/uat/topology-rehearsal-grant.schema.json');
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, GRANT_KEYS);
  assert.deepEqual(Object.keys(schema.properties), GRANT_KEYS);
});

test('T3 a canonical complete exact-action grant passes semantic validation', async () => {
  const { validateGrantDocument } = await implementation();
  assert.deepEqual(validateGrantDocument(grant(), options()), []);
});

test('T3.1 every control repository must be clean', async () => {
  const { validateGrantDocument } = await implementation();
  for (const repository of Object.keys(grant().repositories)) {
    const malformed = grant();
    malformed.repositories[repository].clean = false;
    const findings = validateGrantDocument(malformed, options());
    assert.ok(
      findings.some((finding) => /clean|worktree/i.test(finding)),
      `${repository}: a dirty worktree must be a clean-worktree finding`,
    );
  }
});

test('T3.2 repository tree identities must be valid and distinct', async () => {
  const { validateGrantDocument } = await implementation();
  const repositories = Object.keys(grant().repositories);
  const duplicate = grant();
  duplicate.repositories[repositories[1]].tree = duplicate.repositories[repositories[0]].tree;
  assert.ok(
    validateGrantDocument(duplicate, options())
      .some((finding) => /tree|repository/i.test(finding)),
  );
  const malformed = grant();
  malformed.repositories[repositories[2]].tree = 'not-a-git-tree';
  assert.ok(
    validateGrantDocument(malformed, options())
      .some((finding) => /tree|repository/i.test(finding)),
  );
});

test('T3.3 repository inventory and commit identities are exact and distinct', async () => {
  const { validateGrantDocument } = await implementation();
  const repositories = Object.keys(grant().repositories);
  const missing = grant();
  delete missing.repositories[repositories[0]];
  assert.ok(
    validateGrantDocument(missing, options())
      .some((finding) => /repository|inventory/i.test(finding)),
  );
  const duplicate = grant();
  duplicate.repositories[repositories[1]].commit = duplicate.repositories[repositories[0]].commit;
  assert.ok(
    validateGrantDocument(duplicate, options())
      .some((finding) => /commit|repository/i.test(finding)),
  );
  const malformed = grant();
  malformed.repositories[repositories[2]].commit = 'not-a-git-commit';
  assert.ok(
    validateGrantDocument(malformed, options())
      .some((finding) => /commit|repository/i.test(finding)),
  );
});

for (const key of GRANT_KEYS) {
  test(`T4 missing ${key} fails closed`, async () => {
    const { validateGrantDocument } = await implementation();
    const malformed = grant();
    delete malformed[key];
    assert.ok(validateGrantDocument(malformed, options()).length > 0);
  });
}

// Each case carries its own label so five separately-failing cases cannot collapse into one
// indistinguishable test name in the report.
const NON_CANONICAL_BYTES = [
  ['compact JSON that drops the canonical indentation', Buffer.from(JSON.stringify(grant()))],
  ['a UTF-8 byte order mark', Buffer.from(`\ufeff${JSON.stringify(grant(), null, 2)}\n`)],
  ['a CRLF terminator', Buffer.from(`${JSON.stringify(grant(), null, 2)}\r\n`)],
  ['a trailing byte after the canonical rendering', Buffer.concat([canonicalBytes(grant()), Buffer.from('x')])],
  ['a length beyond the 65536-byte bound', Buffer.alloc(65537, 0x20)],
];

for (const [index, [label, bytes]] of NON_CANONICAL_BYTES.entries()) {
  test(`T5.${index + 1} grant bytes with ${label} are rejected terminally`, async () => {
    const { validateGrantBytes } = await implementation();
    const findings = validateGrantBytes(bytes, options());
    assert.ok(findings.length > 0);
    assert.ok(findings.every((finding) => finding.includes('canonical') || finding.includes('bounded')));
  });
}

test('T6 unresolved selected image identity is one primary finding', async () => {
  const { validateGrantDocument } = await implementation();
  const malformed = grant({
    selected_image_identity: {
      ...grant().selected_image_identity,
      platform: null,
      index_digest: null,
      manifest_digest: null,
    },
  });
  const findings = validateGrantDocument(malformed, options());
  assert.equal(findings.filter((finding) => finding.includes('unresolved')).length, 1);
});

test('T7 local image id cannot equal an index or manifest digest', async () => {
  const { validateGrantDocument } = await implementation();
  const base = grant();
  base.observed_image_identity.local_image_id = base.selected_image_identity.manifest_digest;
  assert.ok(validateGrantDocument(base, options()).some(
    (finding) => finding.includes('identity'),
  ));
});

test('T8 platform index manifest tag and observed identity must agree exactly', async () => {
  const { validateGrantDocument } = await implementation();
  for (const key of ['repository', 'tag', 'platform', 'index_digest', 'manifest_digest']) {
    const base = grant();
    base.observed_image_identity[key] = key === 'platform'
      ? { os: 'linux', architecture: 'amd64', variant: null }
      : 'drift';
    assert.ok(validateGrantDocument(base, options()).length > 0);
  }
});

test('T9 grant window is one 180-second cycle with zero extension', async () => {
  const { validateGrantDocument } = await implementation();
  for (const window of [
    { ...grant().window, runtime_limit_seconds: 181 },
    { ...grant().window, extension_cycles: 1 },
    { ...grant().window, expires_at: '2026-08-05T00:00:00Z' },
  ]) {
    assert.ok(validateGrantDocument(grant({ window }), options()).length > 0);
  }
});

test('T9.1 grant expiry is exactly runtime_limit_seconds after not_before', async () => {
  const { validateGrantDocument } = await implementation();
  const malformed = grant({
    window: { ...grant().window, expires_at: '2026-08-05T00:04:00Z' },
  });
  const findings = validateGrantDocument(malformed, options());
  assert.ok(
    findings.some((finding) => /window|duration|180/i.test(finding)),
    'a four-minute grant window must fail even while now remains inside it',
  );
});

test('T10 every no-authority clause is mandatory and true', async () => {
  const { validateGrantDocument } = await implementation();
  for (const key of Object.keys(grant().grants_no_authority)) {
    const base = grant();
    base.grants_no_authority[key] = false;
    assert.ok(validateGrantDocument(base, options()).length > 0);
  }
});

// The validator declares its top-level units as arrow-function constants, so a body scan that
// only recognises `function name(` silently reads an empty body and reports every ordering
// claim as unmet for the wrong reason. Both declaration forms are accepted here, and the body
// ends at the next top-level declaration.
const NEXT_TOP_LEVEL_DECLARATION = /\n(?:export\s+)?(?:async\s+)?(?:const|let|var|function|class)\s/g;
// The signature is verified by spawning ssh-keygen; either child_process spawn form counts.
const SIGNATURE_SPAWN = /(?:execFileSync|spawnSync)\s*\(\s*['"`][^'"`]*ssh-keygen/;

function topLevelBody(source, name) {
  const starts = [
    `\nconst ${name} = `,
    `\nlet ${name} = `,
    `\nvar ${name} = `,
    `\nfunction ${name}(`,
    `\nasync function ${name}(`,
  ]
    .map((token) => source.indexOf(token))
    .filter((at) => at >= 0);
  if (starts.length === 0) return '';
  const start = Math.min(...starts);
  NEXT_TOP_LEVEL_DECLARATION.lastIndex = start + 1;
  const next = NEXT_TOP_LEVEL_DECLARATION.exec(source);
  return source.slice(start, next ? next.index : undefined);
}

test('T11.1 fail-closed grant authorization is wired before SSHSIG acceptance', () => {
  const source = readFileSync(TOPOLOGY_VALIDATOR_PATH, 'utf8');
  assert.ok(
    /from\s+['"]\.\/validate-topology-grant\.mjs['"]/.test(source),
    'validate-topology-rehearsal.mjs does not import the C8 grant validator',
  );
  const body = topLevelBody(source, 'verifyFounderAuthorization');
  assert.ok(body, 'verifyFounderAuthorization is declared in no recognised top-level form');
  const semanticCall = body.search(/validateGrantBeforeSignature\s*\(/);
  const signatureProcess = body.search(SIGNATURE_SPAWN);
  assert.ok(
    semanticCall >= 0,
    'verifyFounderAuthorization does not call fail-closed grant-before-signature validation (C8)',
  );
  assert.ok(signatureProcess >= 0, 'verifyFounderAuthorization spawns no ssh-keygen verification');
  assert.equal(
    [...body.matchAll(new RegExp(SIGNATURE_SPAWN.source, 'g'))].length,
    1,
    'verifyFounderAuthorization must have exactly one signature process site',
  );
  assert.ok(
    semanticCall < signatureProcess,
    'semantic grant call must execute before the ssh-keygen verification process',
  );
});

test('T11.2 malformed grant bytes never reach the injected signature verifier', async () => {
  const { validateGrantBeforeSignature } = await implementation();
  const malformed = grant({ authorizes: 'different_action' });
  let signatureCalls = 0;
  const findings = validateGrantBeforeSignature(canonicalBytes(malformed), {
    ...options(),
    verifySignature: () => {
      signatureCalls += 1;
      return true;
    },
  });
  assert.ok(findings.length > 0);
  assert.equal(signatureCalls, 0);
});

test('T11.3 canonical valid grant reaches the verifier exactly once and binds its bytes', async () => {
  const { validateGrantBeforeSignature } = await implementation();
  const bytes = canonicalBytes(grant());
  const seen = [];
  const findings = validateGrantBeforeSignature(bytes, {
    ...options(),
    verifySignature: (verifiedBytes) => {
      seen.push(verifiedBytes);
      return true;
    },
  });
  assert.deepEqual(findings, []);
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0], bytes);
});

test('T11.4 false or throwing signature verification fails closed', async () => {
  const { validateGrantBeforeSignature } = await implementation();
  for (const [label, verifySignature] of [
    ['false verdict', () => false],
    ['verifier exception', () => { throw new Error('synthetic verifier failure'); }],
  ]) {
    const findings = validateGrantBeforeSignature(canonicalBytes(grant()), {
      ...options(),
      verifySignature,
    });
    assert.ok(findings.length > 0, `${label}: signature failure must produce a finding`);
  }
});

test('T12 validate.mjs and package scripts register both grant validation targets', () => {
  const source = readFileSync(VALIDATE_PATH, 'utf8');
  const packageJson = JSON.parse(readFileSync(PACKAGE_PATH, 'utf8'));
  assert.ok(source.includes('validate-topology-grant.mjs'), 'validate.mjs does not run the grant validator (C8)');
  assert.ok(source.includes('validate-topology-grant.test.mjs'), 'validate.mjs does not run this grant test (C8)');
  assert.equal(packageJson.scripts['validate:topology-grant'], 'node validate-topology-grant.mjs');
  assert.equal(packageJson.scripts['test:topology-grant'], 'node --test tests/validate-topology-grant.test.mjs');
});

test('T13 both control READMEs state identity separation and no-authority truth', () => {
  for (const path of READMES) {
    const source = readFileSync(path, 'utf8');
    for (const phrase of [
      'selected required image identity',
      'observed host image identity',
      'index digest',
      'manifest digest',
      'local image ID',
      'grants no runtime, UAT, demo, merge, release or production authority',
    ]) {
      assert.ok(source.includes(phrase), `${path}: missing ${phrase}`);
    }
  }
});

test('T14 record schema requires a selected image identity distinct from host observations', () => {
  const schema = JSON.parse(readFileSync(RECORD_SCHEMA_PATH, 'utf8'));
  assert.ok(schema.properties.topology.required.includes('image'), 'topology.image is not required (C8)');
  assert.deepEqual(schema.properties.topology.properties.image, {
    $ref: '#/$defs/selectedImageIdentity',
  });
  const identity = schema.$defs.selectedImageIdentity;
  assert.ok(identity, '$defs.selectedImageIdentity is absent (C8)');
  assert.equal(identity.additionalProperties, false);
  assert.ok(identity.required.includes('resolution_state'));
  assert.ok(!Object.hasOwn(identity.properties, 'local_image_id'));
  assert.deepEqual(
    Object.keys(identity.properties).sort(),
    ['index_digest', 'manifest_digest', 'platform', 'pull_policy', 'repository', 'resolution_state', 'tag'],
  );
});

test('T15 proposed HOLD record declares unresolved selection without a host identity claim', () => {
  const record = JSON.parse(readFileSync(RECORD_PATH, 'utf8'));
  assert.equal(record.attempt.phase, 'proposed');
  assert.equal(record.attempt.execution_authorized, false);
  assert.equal(record.attempt.outcome, 'not_run');
  assert.ok(Object.hasOwn(record.topology, 'image'), 'the record declares no topology.image (C8)');
  assert.equal(record.topology.image.resolution_state, 'UNRESOLVED');
  assert.equal(record.topology.image.index_digest, null);
  assert.equal(record.topology.image.manifest_digest, null);
  assert.equal(record.topology.image.platform, null);
  assert.ok(!Object.hasOwn(record.topology.image, 'local_image_id'));
});

test('T16 the authorized window is closed at not_before and open at expires_at', async () => {
  const { validateGrantDocument } = await implementation();
  assert.deepEqual(validateGrantDocument(grant(), options({ now: '2026-08-05T00:00:00Z' })), []);
  for (const now of ['2026-08-04T23:59:59Z', '2026-08-05T00:03:00Z', '2026-08-05T00:03:01Z']) {
    const findings = validateGrantDocument(grant(), options({ now }));
    assert.ok(
      findings.some((finding) => /window/i.test(finding)),
      `${now}: a now outside the authorized window must be a window finding`,
    );
  }
});

// ---------------------------------------------------------------------------
// C8-C2 — the grant record binding names the pinned proposed prior-state digest.
//
// It cannot name the current authorized record digest: that record embeds `grant_sha256`
// and the grant embeds the record digest, so binding the current hash is a cryptographic
// fixed point rather than a binding. The one attestable target is the exact proposed
// prior-state digest already pinned by the policy state history, which is the same digest
// the record-review byte binding attests. The pin is a required caller-supplied option:
// an absent, malformed or duplicated proposed pin supplies no digest and refuses the grant.
// ---------------------------------------------------------------------------

test('T17 an exact pinned proposed-record binding passes and a drifted binding refuses', async () => {
  const { validateGrantDocument } = await implementation();
  assert.deepEqual(validateGrantDocument(grant(), options()), []);
  const drifted = grant();
  drifted.record.sha256 = TEST_DIGEST('7');
  assert.deepEqual(
    validateGrantDocument(drifted, options()),
    [RECORD_BINDING_FINDING],
    'a record digest other than the pinned proposed digest must refuse the grant',
  );
});

test('T17.1 an absent, malformed or duplicated proposed pin refuses the grant', async () => {
  const { validateGrantDocument } = await implementation();
  for (const [label, pinned] of [
    ['absent option', undefined],
    ['missing or duplicated proposed history supplies null', null],
    ['short hex pin', 'abcdef'],
    ['uppercase pin', 'A'.repeat(64)],
    ['non-hex pin', 'z'.repeat(64)],
    ['numeric pin', 1],
    ['object pin', {}],
  ]) {
    assert.deepEqual(
      validateGrantDocument(grant(), options({ pinnedProposedRecordSha256: pinned })),
      [RECORD_BINDING_FINDING],
      `${label}: an unpinned proposed digest must refuse the grant`,
    );
  }
});

test('T17.2 a grant binding the current record digest instead of the pin refuses', async () => {
  const { validateGrantDocument } = await implementation();
  const currentRecordSha256 = TEST_DIGEST('8');
  const selfBound = grant();
  selfBound.record.sha256 = currentRecordSha256;
  assert.notEqual(currentRecordSha256, PINNED_PROPOSED_RECORD_SHA256);
  assert.deepEqual(
    validateGrantDocument(selfBound, options()),
    [RECORD_BINDING_FINDING],
    'the current record hash is a fixed point, never an attestable prior-state digest',
  );
});

test('T17.3 the record-binding finding stays distinct from the record shape finding', async () => {
  const { validateGrantDocument } = await implementation();
  assert.notEqual(RECORD_BINDING_FINDING, RECORD_SHAPE_FINDING);
  const mispathed = grant();
  mispathed.record.path = 'docs/uat/topology-rehearsals/other-r1/topology-rehearsal.json';
  assert.deepEqual(
    validateGrantDocument(mispathed, options()),
    [RECORD_SHAPE_FINDING],
    'an unpinned record path names its own cause, not a derivative binding cause',
  );
  const malformed = grant();
  malformed.record.sha256 = 'not-a-digest';
  assert.deepEqual(
    validateGrantDocument(malformed, options()),
    [RECORD_SHAPE_FINDING],
    'a malformed record digest is not comparable, so only its shape cause is reported',
  );
});

test('T18 the pinned proposed digest is required through bytes and signature validation', async () => {
  const { validateGrantBytes, validateGrantBeforeSignature } = await implementation();
  const bytes = canonicalBytes(grant());
  assert.deepEqual(validateGrantBytes(bytes, options()), []);
  assert.deepEqual(
    validateGrantBytes(bytes, { now: NOW }),
    [RECORD_BINDING_FINDING],
    'validateGrantBytes must require the pinned proposed digest, not default it away',
  );
  let signatureCalls = 0;
  assert.deepEqual(
    validateGrantBeforeSignature(bytes, {
      now: NOW,
      verifySignature: () => {
        signatureCalls += 1;
        return true;
      },
    }),
    [RECORD_BINDING_FINDING],
    'validateGrantBeforeSignature must require the pinned proposed digest',
  );
  assert.equal(signatureCalls, 0, 'an unpinned grant must never reach the injected verifier');
});

test('T19 the exported signature finding is the exact injected-verifier failure text', async () => {
  const { GRANT_SIGNATURE_FINDING, validateGrantBeforeSignature } = await implementation();
  assert.equal(
    typeof GRANT_SIGNATURE_FINDING,
    'string',
    'the signature finding must be exported so a caller can tell it from a document finding',
  );
  assert.deepEqual(
    validateGrantBeforeSignature(canonicalBytes(grant()), options({
      verifySignature: () => false,
    })),
    [GRANT_SIGNATURE_FINDING],
  );
  assert.deepEqual(
    validateGrantBeforeSignature(canonicalBytes(grant()), options({
      verifySignature: () => true,
    })),
    [],
  );
});

// The exported semantic path is process-free; the command-line dependency resolver below it
// may call the pinned system Git to locate the validation package root.
test('T20 the grant module states its process boundary exactly', () => {
  const source = readFileSync(MODULE_PATH, 'utf8');
  const [semantic, cli] = source.split(
    '// Command-line control surface.',
  );
  assert.ok(cli, 'the grant module must keep a marked command-line control surface');
  assert.doesNotMatch(
    semantic,
    /execFileSync\(|spawnSync\(/u,
    'no exported semantic unit may spawn a process',
  );
  assert.match(cli, /execFileSync\(\s*'\/usr\/bin\/git'/u);
  assert.match(
    source,
    /command-line dependency resolver[\s\S]{0,200}\/usr\/bin\/git/u,
    'the module comment must qualify that only the imported semantic path is process-free',
  );
});
