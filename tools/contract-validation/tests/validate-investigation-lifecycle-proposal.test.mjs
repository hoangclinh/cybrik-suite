import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import {
  expectedPacketPaths,
  validateInvestigationLifecycleProposal,
  validateJsonSchemaValue,
} from '../validate-investigation-lifecycle-proposal.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const GIT_COMMON_DIR = execFileSync(
  'git',
  ['rev-parse', '--path-format=absolute', '--git-common-dir'],
  { cwd: ROOT, encoding: 'utf8' },
).trim();
const CANONICAL_VALIDATOR_ROOT = join(
  dirname(GIT_COMMON_DIR),
  'tools',
  'contract-validation',
);
const canonicalRequire = createRequire(join(CANONICAL_VALIDATOR_ROOT, 'package.json'));
const AjvModule = canonicalRequire('ajv/dist/2020.js');
const addFormatsModule = canonicalRequire('ajv-formats');
const Ajv2020 = AjvModule.default || AjvModule;
const addFormats = addFormatsModule.default || addFormatsModule;

const PROPOSAL_SCHEMA_NAMES = [
  'cybrik.investigation-lifecycle-common-defs.v1.schema.json',
  'cybrik.investigation-create-request.v1.schema.json',
  'cybrik.investigation-status.v1.schema.json',
  'cybrik.investigation-checkpoint.v1.schema.json',
  'cybrik.investigation-cancel-request.v1.schema.json',
  'cybrik.investigation-bundle.strict-compatible.v1.schema.json',
  'cybrik.investigation-bundle-read-result.v1.schema.json',
  'cybrik.investigation-lifecycle-error.v1.schema.json',
];
const ACCEPTED_REF_SCHEMA_NAMES = [
  'cybrik.common-defs.v1.schema.json',
  'cybrik.data-marking.v1.schema.json',
  'cybrik.investigation-common-defs.v1.schema.json',
  'cybrik.investigation-bundle.v1.schema.json',
];

const loadSchema = (name) => JSON.parse(
  readFileSync(resolve(ROOT, 'contracts/json-schema', name), 'utf8'),
);

const compileProposalSchemasStrict = () => {
  const acceptedDocuments = ACCEPTED_REF_SCHEMA_NAMES.map(
    (name) => [name, loadSchema(name)],
  );
  const exactProposalDocuments = PROPOSAL_SCHEMA_NAMES.map(
    (name) => [name, loadSchema(name)],
  );
  const allDocuments = new Map([...acceptedDocuments, ...exactProposalDocuments]);
  const failures = [];
  for (const targetName of PROPOSAL_SCHEMA_NAMES) {
    const ajv = new Ajv2020({ strict: true, allErrors: true });
    addFormats(ajv);
    for (const keyword of [
      'x-cybrik-status',
      'x-cybrik-not-accepted',
      'x-cybrik-contract-version',
      'x-cybrik-format-pins',
    ]) {
      ajv.addKeyword({ keyword });
    }
    try {
      for (const document of allDocuments.values()) ajv.addSchema(document);
      ajv.getSchema(allDocuments.get(targetName).$id);
    } catch (error) {
      failures.push(`${targetName}: ${error.message}`);
    }
  }
  return failures;
};

test('the exact W1-C2 plus W1-REC-3/4 lifecycle packet is internally compatible', async () => {
  const report = await validateInvestigationLifecycleProposal({ root: ROOT });

  assert.deepEqual(report.errors, []);
  assert.equal(report.status, 'ACCEPTED FOR IMPLEMENTATION');
  assert.equal(report.notAccepted, false);
  assert.equal(report.packetVersion, '0.1.0');
  assert.equal(report.counts.packetFiles, expectedPacketPaths.length);
  assert.equal(report.counts.positiveFixtures, 6);
  assert.equal(report.counts.negativeSchemaFixtures, 5);
  assert.equal(report.counts.negativeSemanticFixtures, 7);
  assert.equal(report.counts.runtimeInvariants, 8);
  assert.equal(report.counts.events, 6);
  assert.equal(report.counts.operations, 5);
});

test('W1-BSR1 selects strict-compatible v0.1.1 for new responses and preserves v0.1.0 legacy replay', () => {
  const strictBundle = loadSchema(
    'cybrik.investigation-bundle.strict-compatible.v1.schema.json',
  );
  const manifest = JSON.parse(readFileSync(
    resolve(
      ROOT,
      'contracts/compatibility/cybrik-suite-investigation-lifecycle-proposal.v1.manifest.json',
    ),
    'utf8',
  ));

  assert.equal(strictBundle['x-cybrik-status'], 'ACCEPTED FOR IMPLEMENTATION');
  assert.equal(strictBundle['x-cybrik-not-accepted'], false);
  assert.equal(
    manifest.supersession_mapping.accepted_successor.status,
    'ACCEPTED FOR IMPLEMENTATION — authoritative for new bundle-read responses',
  );
  assert.equal(
    manifest.supersession_mapping.accepted_current.status,
    'ACCEPTED FOR IMPLEMENTATION — immutable legacy read/replay — byte-unchanged',
  );
  assert.match(manifest.supersession_mapping.adoption_rule, /W1-REC-3\/4/);
  assert.match(manifest.supersession_mapping.adoption_rule, /consumer migration remains gated/);
});

test('all eight exact proposal schemas compile transitively with official Ajv 2020-12 strict mode', () => {
  assert.deepEqual(compileProposalSchemasStrict(), []);
});

test('bundle-read prose selects accepted v0.1.1 without migration or runtime overclaim', () => {
  const bundleReadSchema = loadSchema(
    'cybrik.investigation-bundle-read-result.v1.schema.json',
  );
  const openApi = readFileSync(
    resolve(
      ROOT,
      'contracts/openapi/cybrik-ai-investigation-lifecycle-proposal.v1.openapi.yaml',
    ),
    'utf8',
  );

  assert.match(bundleReadSchema.description, /ACCEPTED FOR IMPLEMENTATION strict-compatible v0\.1\.1/);
  assert.match(bundleReadSchema.description, /authoritative for new bundle-read responses/);
  assert.match(bundleReadSchema.description, /immutable supported legacy read\/replay input/);
  assert.match(bundleReadSchema.description, /Consumer migration remains separately gated by W1-REC-5/);
  assert.match(
    openApi,
    /Read the accepted strict-compatible v0\.1\.1 Investigation Bundle through Cyber AI\./,
  );
  assert.doesNotMatch(openApi, /\bPROPOSED\b|NOT ACCEPTED/);
});

test('a manifest half-flip back to PROPOSED is rejected', async () => {
  const regressed = await validateInvestigationLifecycleProposal({
    root: ROOT,
    overrides: mutatedManifestOverride((manifest) => {
      manifest['x-cybrik-status'] = 'PROPOSED';
      manifest['x-cybrik-not-accepted'] = true;
    }),
  });

  assert.ok(regressed.errors.some((message) => message.includes(
    'compatibility manifest must record the W1-C2 acceptance',
  )));
});

test('a regression of accepted strict-compatible v0.1.1 back to proposed is rejected', async () => {
  const relativePath =
    'contracts/json-schema/cybrik.investigation-bundle.strict-compatible.v1.schema.json';
  const parsed = readPacketJson(relativePath);
  parsed['x-cybrik-status'] = 'PROPOSED';
  parsed['x-cybrik-not-accepted'] = true;

  const regressed = await validateInvestigationLifecycleProposal({
    root: ROOT,
    overrides: asOverride(relativePath, parsed),
  });

  assert.ok(regressed.errors.some((message) => message.includes(
    'strict-compatible v0.1.1 must remain ACCEPTED FOR IMPLEMENTATION',
  )));

  const supersessionRegressed = await validateInvestigationLifecycleProposal({
    root: ROOT,
    overrides: mutatedManifestOverride((manifest) => {
      manifest.supersession_mapping.accepted_successor.status = 'PROPOSED — NOT ACCEPTED';
    }),
  });

  assert.ok(supersessionRegressed.errors.some((message) => message.includes(
    'supersession mapping must select accepted v0.1.1',
  )));
});

test('schema, manifest, bundle-read, OpenAPI and AsyncAPI lifecycle half-flips fail closed', async () => {
  const strictPath =
    'contracts/json-schema/cybrik.investigation-bundle.strict-compatible.v1.schema.json';
  const strictBundle = readPacketJson(strictPath);
  strictBundle['x-cybrik-status'] = 'PROPOSED';
  strictBundle['x-cybrik-not-accepted'] = true;

  const bundleReadPath =
    'contracts/json-schema/cybrik.investigation-bundle-read-result.v1.schema.json';
  const bundleRead = readPacketJson(bundleReadPath);
  bundleRead.description = bundleRead.description.replace(
    'authoritative for new bundle-read responses',
    'PROPOSED — NOT ACCEPTED',
  );

  const openApiPath =
    'contracts/openapi/cybrik-ai-investigation-lifecycle-proposal.v1.openapi.yaml';
  const openApi = readPacketText(openApiPath).replace(
    '# Bundle v0.1.1: ACCEPTED FOR IMPLEMENTATION under W1-REC-3/4 and authoritative for new bundle-read responses.',
    '# Bundle v0.1.1: PROPOSED — NOT ACCEPTED.',
  );

  const asyncApiPath =
    'contracts/asyncapi/cybrik-ai-investigation-lifecycle-proposal.v1.asyncapi.yaml';
  const asyncApi = readPacketText(asyncApiPath).replace(
    'x-cybrik-status: ACCEPTED FOR IMPLEMENTATION',
    'x-cybrik-status: PROPOSED',
  );

  const cases = [
    {
      name: 'schema-only',
      overrides: asOverride(strictPath, strictBundle),
      expected: 'strict-compatible v0.1.1 must remain ACCEPTED FOR IMPLEMENTATION',
    },
    {
      name: 'manifest-only',
      overrides: mutatedManifestOverride((manifest) => {
        manifest.members[5].status = 'PROPOSED — NOT ACCEPTED';
      }),
      expected: 'lifecycle status annotation inventory',
    },
    {
      name: 'bundle-read-only',
      overrides: asOverride(bundleReadPath, bundleRead),
      expected: 'lifecycle description must select v0.1.1',
    },
    {
      name: 'OpenAPI-only',
      overrides: new Map([[openApiPath, openApi]]),
      expected: 'lifecycle header/info/bundle-read inventory',
    },
    {
      name: 'AsyncAPI-only',
      overrides: new Map([[asyncApiPath, asyncApi]]),
      expected: 'lifecycle header/info/bundle-publication inventory',
    },
  ];

  for (const { name, overrides, expected } of cases) {
    const report = await validateInvestigationLifecycleProposal({ root: ROOT, overrides });
    assert.ok(
      report.errors.some((message) => message.includes(expected)),
      `${name}: ${expected}`,
    );
  }
});

test('every manifest lifecycle decision locus is inventoried and fails closed on drift', async () => {
  const cases = [
    {
      name: 'additional status annotation',
      mutate: (manifest) => {
        manifest.unexpected_lifecycle_status = 'ACCEPTED FOR IMPLEMENTATION';
      },
      expected: 'lifecycle status annotation inventory',
    },
    {
      name: 'missing member status',
      mutate: (manifest) => {
        delete manifest.members[5].status;
      },
      expected: 'lifecycle status annotation inventory',
    },
    {
      name: 'collision treatment',
      mutate: (manifest) => {
        manifest.collision_status_map.existing_boundaries[0].treatment = 'unchanged';
      },
      expected: 'collision status map',
    },
    {
      name: 'Suite ownership',
      mutate: (manifest) => {
        manifest.ownership.suite = 'Owns runtime Bundle migration.';
      },
      expected: 'product ownership boundaries must remain exact',
    },
    {
      name: 'supersession compatibility',
      mutate: (manifest) => {
        manifest.supersession_mapping.compatibility = 'shape is probably compatible';
      },
      expected: 'supersession compatibility note',
    },
    {
      name: 'transport binding',
      mutate: (manifest) => {
        manifest.supersession_mapping.transport_binding_rule =
          'v0.1.1 automatically migrates every consumer.';
      },
      expected: 'transport binding rule',
    },
    {
      name: 'pending decision inventory',
      mutate: (manifest) => {
        manifest.supersession_mapping.pending_founder_decisions.push(
          'Reopen W1-REC-3.',
        );
      },
      expected: 'supersession mapping must select accepted v0.1.1',
    },
    {
      name: 'adoption rule',
      mutate: (manifest) => {
        manifest.supersession_mapping.adoption_rule =
          'All consumers are migrated automatically.';
      },
      expected: 'adoption rule',
    },
    {
      name: 'gate status',
      mutate: (manifest) => {
        manifest.gate.status = 'PROPOSED';
      },
      expected: 'lifecycle status annotation inventory',
    },
    {
      name: 'gate decision',
      mutate: (manifest) => {
        manifest.gate.decision = 'Runtime and release are authorized.';
      },
      expected: 'gate status and decision',
    },
    {
      name: 'acceptance record',
      mutate: (manifest) => {
        manifest.acceptance_record[0] = 'W1-C2 only.';
      },
      expected: 'acceptance record',
    },
    {
      name: 'open decision current value',
      mutate: (manifest) => {
        manifest.open_decisions[0].current = 'OPEN';
      },
      expected: 'open-decision inventory',
    },
    {
      name: 'top lifecycle description',
      mutate: (manifest) => {
        manifest.description = 'PROPOSED — NOT ACCEPTED';
      },
      expected: 'top-level lifecycle description',
    },
    {
      name: 'manifest title',
      mutate: (manifest) => {
        manifest.title = 'CYBRIK W1 GA release manifest';
      },
      expected: 'title must remain the reviewed contract-packet title',
    },
  ];

  for (const { name, mutate, expected } of cases) {
    const report = await validateInvestigationLifecycleProposal({
      root: ROOT,
      overrides: mutatedManifestOverride(mutate),
    });
    assert.ok(
      report.errors.some((message) => message.includes(expected)),
      `${name}: ${expected}`,
    );
  }
});

test('unknown manifest lifecycle loci and every product ownership boundary fail closed', async () => {
  const cases = [
    {
      name: 'object-valued nested status locus',
      mutate: (manifest) => {
        manifest.extra_block = {
          status: {
            bundle: 'PROPOSED — NOT ACCEPTED',
          },
        };
      },
      expected: 'lifecycle status annotation inventory',
    },
    {
      name: 'object-valued suffixed status locus',
      mutate: (manifest) => {
        manifest.gate.runtime_status = {
          value: 'runtime authority granted; CI wired',
        };
      },
      expected: 'lifecycle status annotation inventory',
    },
    {
      name: 'unknown lifecycle wording locus',
      mutate: (manifest) => {
        manifest.lifecycle_note =
          'Bundle v0.1.1 is proposed and not accepted for new responses.';
      },
      expected: 'unknown top-level locus or stale lifecycle wording',
    },
    {
      name: 'Cyber AI ownership inversion',
      mutate: (manifest) => {
        manifest.ownership.cyber_ai = 'Consumer only.';
      },
      expected: 'product ownership boundaries must remain exact',
    },
    {
      name: 'SOC ownership inversion',
      mutate: (manifest) => {
        manifest.ownership.soc =
          'Sole bundle producer and lifecycle authority; SOC may rewrite a bundle.';
      },
      expected: 'product ownership boundaries must remain exact',
    },
    {
      name: 'Fabric execution-authority grant',
      mutate: (manifest) => {
        manifest.ownership.fabric =
          'Fabric executes bundle-read tools under this packet.';
      },
      expected: 'product ownership boundaries must remain exact',
    },
    {
      name: 'promoted member version contradiction',
      mutate: (manifest) => {
        manifest.members[5].contract_version = '0.1.0';
      },
      expected: 'promoted Bundle member contract version must remain 0.1.1',
    },
    {
      name: 'runtime invariant authority rewrite',
      mutate: (manifest) => {
        manifest.runtime_invariants[0].statement =
          'Runtime deployment is authorized.';
      },
      expected: 'runtime invariant inventory must remain exact',
    },
  ];

  for (const { name, mutate, expected } of cases) {
    const report = await validateInvestigationLifecycleProposal({
      root: ROOT,
      overrides: mutatedManifestOverride(mutate),
    });
    assert.ok(
      report.errors.some((message) => message.includes(expected)),
      `${name}: ${expected}`,
    );
  }
});

test('nested or extra schema lifecycle annotations fail closed', async () => {
  const relativePath =
    'contracts/json-schema/cybrik.investigation-bundle.strict-compatible.v1.schema.json';
  const parsed = readPacketJson(relativePath);
  parsed.properties.bundle_id['x-cybrik-status'] = 'ACCEPTED FOR IMPLEMENTATION';

  const report = await validateInvestigationLifecycleProposal({
    root: ROOT,
    overrides: asOverride(relativePath, parsed),
  });

  assert.ok(report.errors.some((message) => message.includes(
    'lifecycle annotation inventory must contain exactly one top-level status',
  )));
});

test('stale lifecycle and unauthorized promotion prose fails closed across schemas', async () => {
  const strictPath =
    'contracts/json-schema/cybrik.investigation-bundle.strict-compatible.v1.schema.json';
  const bundleReadPath =
    'contracts/json-schema/cybrik.investigation-bundle-read-result.v1.schema.json';
  const commonDefsPath =
    'contracts/json-schema/cybrik.investigation-lifecycle-common-defs.v1.schema.json';
  const cases = [
    {
      path: strictPath,
      mutate: (schema) => {
        schema.description += ' This member remains PROPOSED — NOT ACCEPTED.';
      },
    },
    {
      path: strictPath,
      mutate: (schema) => {
        schema.description += ' Now stable v1 GA and IMPLEMENTED.';
      },
    },
    {
      path: strictPath,
      mutate: (schema) => {
        schema.description += ' Consumer migration is authorized.';
      },
    },
    {
      path: bundleReadPath,
      mutate: (schema) => {
        schema.description += ' The successor is proposed and not yet accepted.';
      },
    },
    {
      path: commonDefsPath,
      mutate: (schema) => {
        schema.description += ' Runtime authority is granted and CI is wired.';
      },
    },
  ];

  for (const { path, mutate } of cases) {
    const schema = readPacketJson(path);
    mutate(schema);
    const report = await validateInvestigationLifecycleProposal({
      root: ROOT,
      overrides: asOverride(path, schema),
    });
    assert.ok(
      report.errors.some((message) => message.includes(
        'schema lifecycle wording or authority boundary',
      )),
      path,
    );
  }
});

test('OpenAPI and AsyncAPI lifecycle status annotations are unique and stale wording is rejected', async () => {
  const openApiPath =
    'contracts/openapi/cybrik-ai-investigation-lifecycle-proposal.v1.openapi.yaml';
  const asyncApiPath =
    'contracts/asyncapi/cybrik-ai-investigation-lifecycle-proposal.v1.asyncapi.yaml';
  const reports = await Promise.all([
    validateInvestigationLifecycleProposal({
      root: ROOT,
      overrides: new Map([[
        openApiPath,
        `${readPacketText(openApiPath)}\n# x-cybrik-status: ACCEPTED FOR IMPLEMENTATION\n`,
      ]]),
    }),
    validateInvestigationLifecycleProposal({
      root: ROOT,
      overrides: new Map([[
        asyncApiPath,
        readPacketText(asyncApiPath).replace(
          'accepted v0.1.1 bundle authoritative for new publications',
          'PROPOSED — NOT ACCEPTED bundle',
        ),
      ]]),
    }),
  ]);

  assert.ok(reports[0].errors.some((message) => message.includes(
    'must contain exactly one status and one not-accepted flag',
  )));
  assert.ok(reports[1].errors.some((message) => message.includes(
    'stale pre-W1-REC Bundle lifecycle wording is forbidden',
  )));
});

test('lowercase stale lifecycle wording in OpenAPI and AsyncAPI fails closed', async () => {
  const openApiPath =
    'contracts/openapi/cybrik-ai-investigation-lifecycle-proposal.v1.openapi.yaml';
  const asyncApiPath =
    'contracts/asyncapi/cybrik-ai-investigation-lifecycle-proposal.v1.asyncapi.yaml';
  const reports = await Promise.all([
    validateInvestigationLifecycleProposal({
      root: ROOT,
      overrides: new Map([[
        openApiPath,
        `${readPacketText(openApiPath)}\nx-cybrik-lifecycle-note: proposed and not accepted\n`,
      ]]),
    }),
    validateInvestigationLifecycleProposal({
      root: ROOT,
      overrides: new Map([[
        asyncApiPath,
        `${readPacketText(asyncApiPath)}\nx-cybrik-lifecycle-note: not yet accepted; only proposed\n`,
      ]]),
    }),
  ]);

  for (const report of reports) {
    assert.ok(report.errors.some((message) => message.includes(
      'stale pre-W1-REC Bundle lifecycle wording is forbidden',
    )));
  }
});

test('a byte change to the accepted v0.1.0 bundle breaks the supersession sha256 pin', async () => {
  const relativePath = 'contracts/json-schema/cybrik.investigation-bundle.v1.schema.json';
  const overrides = new Map([[relativePath, `${readPacketText(relativePath)} `]]);

  const report = await validateInvestigationLifecycleProposal({ root: ROOT, overrides });

  assert.ok(report.errors.some((message) => message.includes(
    'must match the supersession-pinned sha256',
  )));
});

test('a coordinated v0.1.0 byte and manifest-pin rewrite cannot replace the admission digest', async () => {
  const acceptedPath = 'contracts/json-schema/cybrik.investigation-bundle.v1.schema.json';
  const mutatedAcceptedText = `${readPacketText(acceptedPath)} `;
  const manifest = readPacketJson(MANIFEST_RELATIVE_PATH);
  manifest.supersession_mapping.accepted_current.sha256 = sha256Hex(mutatedAcceptedText);

  const report = await validateInvestigationLifecycleProposal({
    root: ROOT,
    overrides: new Map([
      [acceptedPath, mutatedAcceptedText],
      [MANIFEST_RELATIVE_PATH, `${JSON.stringify(manifest, null, 2)}\n`],
    ]),
  });

  assert.ok(report.errors.some((message) => message.includes(
    'must remain the exact admission sha256',
  )));
  assert.equal(
    readPacketJson(MANIFEST_RELATIVE_PATH)
      .supersession_mapping.accepted_current.sha256,
    '501cb160f2fe7035c824d5b0ab37b74d5624cf99a7c25c7adffa72dff9c53bb1',
  );
  assert.equal(
    sha256Hex(readPacketText(acceptedPath)),
    '501cb160f2fe7035c824d5b0ab37b74d5624cf99a7c25c7adffa72dff9c53bb1',
  );
});

test('an OpenAPI server or Fabric-owned execution path is rejected', async () => {
  const relativePath =
    'contracts/openapi/cybrik-ai-investigation-lifecycle-proposal.v1.openapi.yaml';
  const original = readFileSync(resolve(ROOT, relativePath), 'utf8');
  const overrides = new Map([
    [
      relativePath,
      `${original}\nservers:\n  - url: https://runtime.invalid\n  /api/v1/invocations:\n`,
    ],
  ]);

  const report = await validateInvestigationLifecycleProposal({ root: ROOT, overrides });

  assert.ok(report.errors.some((message) => message.includes('must declare no servers')));
  assert.ok(report.errors.some((message) => message.includes('Fabric execution paths')));
});

test('the no-existence-leak error cannot disclose existence or authorization outcome', async () => {
  const relativePath =
    'contracts/json-schema/cybrik.investigation-lifecycle-error.v1.schema.json';
  const original = readFileSync(resolve(ROOT, relativePath), 'utf8');
  const parsed = JSON.parse(original);
  parsed.properties.resource_exists = { type: 'boolean' };
  delete parsed.allOf[0].then.properties.message_safe;
  const overrides = new Map([[relativePath, `${JSON.stringify(parsed, null, 2)}\n`]]);

  const report = await validateInvestigationLifecycleProposal({ root: ROOT, overrides });

  assert.ok(report.errors.some((message) => message.includes('existence disclosure')));
  assert.ok(report.errors.some((message) => message.includes('constant sanitized message')));
});

test('the proposal cannot acquire capability, delegation, approval, tool, or MCP authority', async () => {
  const relativePath =
    'contracts/json-schema/cybrik.investigation-create-request.v1.schema.json';
  const original = readFileSync(resolve(ROOT, relativePath), 'utf8');
  const parsed = JSON.parse(original);
  parsed.properties.capability = { type: 'string' };
  const overrides = new Map([[relativePath, `${JSON.stringify(parsed, null, 2)}\n`]]);

  const report = await validateInvestigationLifecycleProposal({ root: ROOT, overrides });

  assert.ok(report.errors.some((message) => message.includes('execution-authority field')));
});

test('AsyncAPI producer ownership remains Cyber AI and bus binding remains undecided', async () => {
  const relativePath =
    'contracts/asyncapi/cybrik-ai-investigation-lifecycle-proposal.v1.asyncapi.yaml';
  const original = readFileSync(resolve(ROOT, relativePath), 'utf8');
  const overrides = new Map([
    [
      relativePath,
      original
        .replace('Cyber AI is the sole producer', 'Fabric is the sole producer')
        .concat('\nservers:\n  production:\n    host: broker.invalid\n'),
    ],
  ]);

  const report = await validateInvestigationLifecycleProposal({ root: ROOT, overrides });

  assert.ok(report.errors.some((message) => message.includes('Cyber AI producer boundary')));
  assert.ok(report.errors.some((message) => message.includes('must declare no servers')));
});

test('cancel and checkpoint semantic fixtures exercise race, retry and tenant/org guards', async () => {
  const report = await validateInvestigationLifecycleProposal({ root: ROOT });
  const semanticIds = new Set(report.semanticInvariantIds);

  for (const id of [
    'TR-1',
    'TR-2',
    'TR-3',
    'TR-4',
    'TR-5',
    'TR-6',
    'TR-7',
    'TR-8',
  ]) {
    assert.ok(semanticIds.has(id), `${id} must be exercised`);
  }
  assert.deepEqual(report.invariantFixtureMap['TR-7'], [
    'negative-semantic/investigation-bundle-read-result.marking-downgrade.json',
  ]);
  assert.deepEqual(report.invariantFixtureMap['TR-8'], [
    'negative-schema/investigation-lifecycle-error.existence-leak.json',
    'positive/investigation-lifecycle-error.not-found.json',
  ]);
});

test('the standalone JSON Schema subset fails closed across boundary keywords', () => {
  const document = {
    $defs: {
      token: {
        type: 'string',
        minLength: 2,
      },
    },
  };
  const context = {
    schemas: new Map(),
    currentDocument: document,
  };
  const invalidObject = {
    type: 'object',
    additionalProperties: false,
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        maxLength: 3,
        pattern: '^[a-z]+$',
      },
      count: {
        type: 'integer',
        maximum: 2,
      },
      when: {
        type: 'string',
        format: 'date-time',
      },
      id: {
        type: 'string',
        format: 'uuid',
      },
      list: {
        type: 'array',
        minItems: 2,
        maxItems: 2,
        uniqueItems: true,
        items: {
          type: 'number',
        },
      },
    },
  };

  assert.ok(validateJsonSchemaValue(null, 1, context).length > 0);
  assert.ok(
    validateJsonSchemaValue(
      invalidObject,
      {
        name: 'TOOLONG',
        count: 3,
        when: 'not-a-date',
        id: 'not-a-uuid',
        list: [1, 1, 1],
        extra: true,
      },
      context,
    ).length >= 8,
  );
  assert.ok(
    validateJsonSchemaValue(
      {
        anyOf: [{ const: 'a' }, { const: 'b' }],
      },
      'c',
      context,
    ).some((message) => message.includes('anyOf')),
  );
  assert.ok(
    validateJsonSchemaValue(
      {
        if: { const: 'a' },
        then: { const: 'b' },
        else: { const: 'c' },
      },
      'd',
      context,
    ).length > 0,
  );
  assert.ok(
    validateJsonSchemaValue(
      {
        $ref: '#/$defs/missing',
      },
      'x',
      context,
    ).some((message) => message.includes('unresolved')),
  );
  assert.deepEqual(
    validateJsonSchemaValue(
      {
        $ref: '#/$defs/token',
      },
      'ok',
      context,
    ),
    [],
  );
  assert.ok(validateJsonSchemaValue({ type: ['boolean', 'null'] }, 1, context).length > 0);
  assert.deepEqual(validateJsonSchemaValue({ type: 'null' }, null, context), []);
  assert.deepEqual(validateJsonSchemaValue({ type: 'unknown' }, 'anything', context), []);
  assert.ok(
    validateJsonSchemaValue({ enum: ['a', 'b'] }, 'c', context)
      .some((message) => message.includes('outside enum')),
  );
  assert.ok(
    validateJsonSchemaValue({ type: 'array', maxItems: 1 }, [1, 2], context)
      .some((message) => message.includes('maxItems')),
  );
  assert.ok(
    validateJsonSchemaValue({ type: 'string', minLength: 4 }, 'ab', context)
      .some((message) => message.includes('minLength')),
  );
  assert.ok(
    validateJsonSchemaValue({ type: 'number', minimum: 5 }, 1, context)
      .some((message) => message.includes('below minimum')),
  );
  assert.ok(
    validateJsonSchemaValue({ const: { a: 1 } }, { a: 2 }, context)
      .some((message) => message.includes('differs from const')),
  );
  assert.ok(
    validateJsonSchemaValue({ $ref: 'no-such-file.json#/$defs/x' }, 'v', context)
      .some((message) => message.includes('unresolved')),
  );
  assert.ok(
    validateJsonSchemaValue({ $ref: 'weird-fragment' }, 'v', context)
      .some((message) => message.includes('unresolved')),
  );
  assert.deepEqual(
    validateJsonSchemaValue({ if: { const: 'a' }, then: { const: 'a' } }, 'a', context),
    [],
  );
});

// ---------------------------------------------------------------------------
// W1-C2 remediation: packet integrity, declared verification commands, and the
// scope of the accepted strict-compatible bundle successor.
// ---------------------------------------------------------------------------

const MANIFEST_RELATIVE_PATH =
  'contracts/compatibility/cybrik-suite-investigation-lifecycle-proposal.v1.manifest.json';
const EXAMPLES_RELATIVE_PATH =
  'contracts/examples/investigation-lifecycle/examples-manifest.json';
const ASYNCAPI_RELATIVE_PATH =
  'contracts/asyncapi/cybrik-ai-investigation-lifecycle-proposal.v1.asyncapi.yaml';
const FIXTURE_ROOT = 'contracts/examples/investigation-lifecycle/';
const PACKET_INTEGRITY_KEY = 'x-cybrik-packet-integrity';
const CONTRACTS_PATH_ROOT = 'contracts/';
const PACKET_MEMBER_COUNT = 30;

const readPacketText = (relativePath) => readFileSync(resolve(ROOT, relativePath), 'utf8');
const readPacketJson = (relativePath) => JSON.parse(readPacketText(relativePath));
const sha256Hex = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const asOverride = (relativePath, document) => new Map([
  [relativePath, `${JSON.stringify(document, null, 2)}\n`],
]);
const byFile = (left, right) => (left.file < right.file ? -1 : left.file > right.file ? 1 : 0);

// Deliberately an independent re-implementation of the rules the manifest declares, so the
// digests are cross-checked by two separate code paths rather than by shared helpers.
const selfDigestInput = (manifest) => {
  const withoutIntegrity = JSON.parse(JSON.stringify(manifest));
  delete withoutIntegrity[PACKET_INTEGRITY_KEY];
  return JSON.stringify(withoutIntegrity);
};

const recomputeMemberDigests = () => expectedPacketPaths.map((relativePath) => ({
  file: relativePath.slice(CONTRACTS_PATH_ROOT.length),
  sha256: relativePath === MANIFEST_RELATIVE_PATH
    ? sha256Hex(selfDigestInput(readPacketJson(MANIFEST_RELATIVE_PATH)))
    : sha256Hex(readPacketText(relativePath)),
}));

const recomputeAggregate = (entries) => sha256Hex(
  [...entries]
    .sort(byFile)
    .map((entry) => `${entry.sha256}  ${entry.file}`)
    .join('\n'),
);

const mutatedManifestOverride = (mutate) => {
  const manifest = readPacketJson(MANIFEST_RELATIVE_PATH);
  mutate(manifest);
  return asOverride(MANIFEST_RELATIVE_PATH, manifest);
};

const EXPECTED_VERIFICATION_COMMANDS = {
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

test('the manifest pins a sha256 digest for every one of the thirty packet members', () => {
  const manifest = readPacketJson(MANIFEST_RELATIVE_PATH);
  const integrity = manifest[PACKET_INTEGRITY_KEY];

  assert.equal(expectedPacketPaths.length, PACKET_MEMBER_COUNT);
  assert.ok(integrity, 'the manifest must carry a packet integrity block');
  assert.equal(integrity.algorithm, 'sha256');
  assert.equal(integrity.member_count, PACKET_MEMBER_COUNT);
  assert.equal(integrity.path_root, CONTRACTS_PATH_ROOT);

  const declared = integrity.member_digests;
  assert.ok(Array.isArray(declared));
  assert.equal(declared.length, PACKET_MEMBER_COUNT);
  assert.equal(new Set(declared.map((entry) => entry.file)).size, PACKET_MEMBER_COUNT);
  assert.deepEqual(
    declared.map((entry) => entry.file).sort(),
    expectedPacketPaths.map((path) => path.slice(CONTRACTS_PATH_ROOT.length)).sort(),
  );
  for (const entry of declared) assert.match(entry.sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual([...declared].sort(byFile), recomputeMemberDigests().sort(byFile));
});

test('the declared aggregate algorithm is non-circular and reproduces the recorded digest', () => {
  const manifest = readPacketJson(MANIFEST_RELATIVE_PATH);
  const integrity = manifest[PACKET_INTEGRITY_KEY];
  const hashedSelfInput = selfDigestInput(manifest);

  // Non-circularity: no digest is ever part of a digest input.
  assert.ok(!hashedSelfInput.includes(PACKET_INTEGRITY_KEY));
  assert.ok(!hashedSelfInput.includes(integrity.aggregate_sha256));
  for (const entry of integrity.member_digests) {
    assert.ok(!hashedSelfInput.includes(entry.sha256));
  }

  assert.match(integrity.self_digest_rule, /non-circular/);
  assert.match(integrity.aggregate_algorithm, /never depends on its own value/);
  assert.match(integrity.aggregate_sha256, /^[0-9a-f]{64}$/);
  assert.equal(integrity.aggregate_sha256, recomputeAggregate(recomputeMemberDigests()));
});

test('a tampered packet member byte fails the integrity check closed', async () => {
  const relativePath = `${FIXTURE_ROOT}positive/investigation-checkpoint.json`;
  const overrides = new Map([[relativePath, `${readPacketText(relativePath)} `]]);

  const report = await validateInvestigationLifecycleProposal({ root: ROOT, overrides });

  assert.ok(report.errors.some((message) => message.includes(
    'positive/investigation-checkpoint.json: packet member sha256 mismatch',
  )));
  assert.ok(report.errors.some((message) => message.includes('aggregate digest mismatch')));
});

test('a tampered manifest body is caught by the non-circular self digest', async () => {
  const overrides = mutatedManifestOverride((manifest) => {
    manifest.ownership.fabric = 'Fabric owns lifecycle execution authority.';
  });

  const report = await validateInvestigationLifecycleProposal({ root: ROOT, overrides });

  assert.ok(report.errors.some((message) => message.includes(
    'compatibility/cybrik-suite-investigation-lifecycle-proposal.v1.manifest.json: packet member sha256 mismatch',
  )));
});

test('a removed, emptied or reworded integrity block fails closed', async () => {
  const removed = await validateInvestigationLifecycleProposal({
    root: ROOT,
    overrides: mutatedManifestOverride((manifest) => {
      delete manifest[PACKET_INTEGRITY_KEY];
    }),
  });
  assert.ok(removed.errors.some((message) => message.includes(
    'must declare a sha256 packet integrity block',
  )));

  const emptied = await validateInvestigationLifecycleProposal({
    root: ROOT,
    overrides: mutatedManifestOverride((manifest) => {
      manifest[PACKET_INTEGRITY_KEY].member_digests = [];
    }),
  });
  assert.ok(emptied.errors.some((message) => message.includes(
    'member set must be the exact unique thirty-member packet inventory',
  )));

  const reworded = await validateInvestigationLifecycleProposal({
    root: ROOT,
    overrides: mutatedManifestOverride((manifest) => {
      manifest[PACKET_INTEGRITY_KEY].aggregate_algorithm = 'trust me';
      manifest[PACKET_INTEGRITY_KEY].self_digest_rule = 'trust me too';
      manifest[PACKET_INTEGRITY_KEY].algorithm = 'md5';
      manifest[PACKET_INTEGRITY_KEY].member_count = 3;
    }),
  });
  for (const field of ['aggregate_algorithm', 'self_digest_rule', 'algorithm', 'member_count']) {
    assert.ok(
      reworded.errors.some((message) => message.includes(
        `packet integrity declaration field '${field}'`,
      )),
      field,
    );
  }
});

test('a tampered aggregate digest or a swapped member digest fails closed', async () => {
  const swapped = await validateInvestigationLifecycleProposal({
    root: ROOT,
    overrides: mutatedManifestOverride((manifest) => {
      manifest[PACKET_INTEGRITY_KEY].member_digests[0].sha256 = '0'.repeat(64);
      manifest[PACKET_INTEGRITY_KEY].aggregate_sha256 = 'f'.repeat(64);
    }),
  });

  assert.ok(swapped.errors.some((message) => message.includes('packet member sha256 mismatch')));
  assert.ok(swapped.errors.some((message) => message.includes('aggregate digest mismatch')));
});

test('the manifest declares the exact validator, test, Ajv strict, Spectral and AsyncAPI commands', () => {
  const manifest = readPacketJson(MANIFEST_RELATIVE_PATH);

  assert.deepEqual(manifest.verification_commands, EXPECTED_VERIFICATION_COMMANDS);
  assert.match(manifest.verification_commands.ci_wiring, /^NOT WIRED/);
  assert.match(manifest.verification_commands.ci_wiring, /later integration gate/);
  assert.match(manifest.verification_commands.spectral_openapi, /spectral lint/);
  assert.match(manifest.verification_commands.asyncapi, /@asyncapi\/parser/);
  assert.match(manifest.verification_commands.ajv_strict, /--test-name-pattern/);
});

test('missing or mutated verification command metadata fails closed', async () => {
  const removed = await validateInvestigationLifecycleProposal({
    root: ROOT,
    overrides: mutatedManifestOverride((manifest) => {
      delete manifest.verification_commands;
    }),
  });
  assert.ok(removed.errors.some((message) => message.includes(
    'must declare the exact reviewed verification commands',
  )));

  const mutated = await validateInvestigationLifecycleProposal({
    root: ROOT,
    overrides: mutatedManifestOverride((manifest) => {
      manifest.verification_commands.spectral_openapi = 'echo ok';
    }),
  });
  assert.ok(mutated.errors.some((message) => message.includes(
    'must declare the exact reviewed verification commands',
  )));

  const overclaimed = await validateInvestigationLifecycleProposal({
    root: ROOT,
    overrides: mutatedManifestOverride((manifest) => {
      manifest.verification_commands.ci_wiring = 'WIRED — these commands run in canonical CI.';
    }),
  });
  assert.ok(overclaimed.errors.some((message) => message.includes(
    'canonical CI wiring is a later integration gate',
  )));
});

test('successor wording keeps accepted v0.1.0 2020-12 conformant and scopes v0.1.1 to Ajv strict', () => {
  const manifest = readPacketJson(MANIFEST_RELATIVE_PATH);
  const note = manifest.supersession_mapping.compatibility;
  const strictBundle = loadSchema('cybrik.investigation-bundle.strict-compatible.v1.schema.json');
  const acceptedBundle = loadSchema('cybrik.investigation-bundle.v1.schema.json');

  // The accepted v0.1.0 allOf[1] really is a bare `required` subschema with no `properties`.
  assert.deepEqual(
    acceptedBundle.properties.generated_by.allOf[1],
    { required: ['tenant_id'] },
  );
  assert.equal(acceptedBundle.$schema, 'https://json-schema.org/draft/2020-12/schema');

  for (const phrase of [
    'remains fully JSON Schema 2020-12 conformant',
    'bare subschema {"required":["tenant_id"]}',
    "Ajv's optional strict-mode house style",
    'newly written into allOf[1]',
    'semantically redundant',
  ]) {
    assert.ok(note.includes(phrase), `supersession note must state: ${phrase}`);
  }
  for (const phrase of [
    'already-existing tenant_id',
    'type=object/tenant_id property annotation',
  ]) {
    assert.ok(!note.includes(phrase), `supersession note must not claim: ${phrase}`);
  }
  for (const phrase of [
    'fully JSON Schema 2020-12 conformant',
    "only Ajv's optional strict mode rejects",
    'did not previously exist in allOf[1]',
  ]) {
    assert.ok(strictBundle.description.includes(phrase), `bundle description must state: ${phrase}`);
  }
  assert.ok(!strictBundle.description.includes('already-existing tenant_id'));
});

test('inaccurate successor wording fails closed', async () => {
  const manifestDrift = await validateInvestigationLifecycleProposal({
    root: ROOT,
    overrides: mutatedManifestOverride((manifest) => {
      manifest.supersession_mapping.compatibility =
        'Semantic shape is preserved. The proposed successor changes only necessary proposal metadata plus explicit type=object/tenant_id property annotation on generated_by.allOf[1] for Ajv 2020-12 strict compatibility.';
    }),
  });
  assert.ok(manifestDrift.errors.some((message) => message.includes(
    'supersession compatibility note',
  )));

  const relativePath =
    'contracts/json-schema/cybrik.investigation-bundle.strict-compatible.v1.schema.json';
  const parsed = readPacketJson(relativePath);
  parsed.description = 'PROPOSED v0.1.1 revision that fixes the already-existing tenant_id property definition so the schema becomes JSON Schema 2020-12 valid.';
  const schemaDrift = await validateInvestigationLifecycleProposal({
    root: ROOT,
    overrides: asOverride(relativePath, parsed),
  });
  assert.ok(schemaDrift.errors.some((message) => message.includes(
    'strict-compatible bundle description',
  )));
});

// ---------------------------------------------------------------------------
// Fail-closed coverage of the remaining validator guards.
// ---------------------------------------------------------------------------

test('an absent packet root fails closed on every expected member', async () => {
  const report = await validateInvestigationLifecycleProposal({
    root: resolve(ROOT, 'no-such-packet-root'),
  });

  assert.ok(report.errors.some((message) => message.includes('missing expected packet file')));
  assert.equal(report.counts.packetFiles, 0);
});

test('unparseable packet JSON fails closed', async () => {
  const report = await validateInvestigationLifecycleProposal({
    root: ROOT,
    overrides: new Map([[MANIFEST_RELATIVE_PATH, '{ not json']]),
  });

  assert.ok(report.errors.some((message) => message.includes('JSON parse failed')));
});

test('manifest version, bundle-tag, inventory, operation, event and invariant drift fail closed', async () => {
  const report = await validateInvestigationLifecycleProposal({
    root: ROOT,
    overrides: mutatedManifestOverride((manifest) => {
      manifest['x-cybrik-packet-version'] = '0.2.0';
      manifest['x-cybrik-is-bundle-tag'] = true;
      manifest.members.pop();
      manifest.operation_contract.operations = ['createInvestigation'];
      manifest.event_contract.events = [];
      manifest.supersession_mapping.accepted_successor.contract_version = '0.2.0';
      manifest.runtime_invariants = manifest.runtime_invariants.slice(0, 3);
    }),
  });

  for (const fragment of [
    'packet version must remain 0.1.0',
    'immutable bundle tag',
    'exact unique ten-member contract set',
    'operationIds must exactly match',
    'event names must exactly match',
    'supersession mapping must select accepted v0.1.1',
    'runtime invariant inventory must be exactly TR-1..TR-8',
  ]) {
    assert.ok(report.errors.some((message) => message.includes(fragment)), fragment);
  }
});

test('accepted schema status, version, dialect and reference drift fail closed', async () => {
  const relativePath = 'contracts/json-schema/cybrik.investigation-status.v1.schema.json';
  const parsed = readPacketJson(relativePath);
  parsed['x-cybrik-status'] = 'PROPOSED';
  parsed['x-cybrik-not-accepted'] = true;
  parsed['x-cybrik-contract-version'] = '9.9.9';
  parsed.$schema = 'http://json-schema.org/draft-07/schema#';
  delete parsed.$id;
  parsed.properties.drift_probe = {
    $ref: 'cybrik.does-not-exist.v1.schema.json#/$defs/missing',
  };

  const report = await validateInvestigationLifecycleProposal({
    root: ROOT,
    overrides: asOverride(relativePath, parsed),
  });

  for (const fragment of [
    'must record the W1-C2 acceptance',
    'contract version must remain 0.1.0',
    'must pin JSON Schema 2020-12',
    'missing or duplicate $id',
    'unresolved $ref',
  ]) {
    assert.ok(report.errors.some((message) => message.includes(fragment)), fragment);
  }
});

test('strict-compatible bundle drift beyond the reviewed annotation fails closed', async () => {
  const relativePath =
    'contracts/json-schema/cybrik.investigation-bundle.strict-compatible.v1.schema.json';
  const parsed = readPacketJson(relativePath);
  parsed.properties.claims.minItems = 0;

  const report = await validateInvestigationLifecycleProposal({
    root: ROOT,
    overrides: asOverride(relativePath, parsed),
  });

  assert.ok(report.errors.some((message) => message.includes(
    'may differ from accepted v0.1.0 only by proposal metadata',
  )));
});

test('AsyncAPI rebinding to the accepted bundle bytes fails closed', async () => {
  const original = readPacketText(ASYNCAPI_RELATIVE_PATH);

  const report = await validateInvestigationLifecycleProposal({
    root: ROOT,
    overrides: new Map([[
      ASYNCAPI_RELATIVE_PATH,
      original.replaceAll(
        '../json-schema/cybrik.investigation-bundle.strict-compatible.v1.schema.json',
        '../json-schema/cybrik.investigation-bundle.v1.schema.json',
      ),
    ]]),
  });

  assert.ok(report.errors.some((message) => message.includes(
    'must bind only accepted strict-compatible v0.1.1',
  )));
});

test('examples manifest status, kind, invariant id and mapping drift fail closed', async () => {
  const parsed = readPacketJson(EXAMPLES_RELATIVE_PATH);
  parsed['x-cybrik-status'] = 'PROPOSED';
  parsed['x-cybrik-not-accepted'] = true;
  parsed.examples[0].kind = 'unknown-kind';
  parsed.examples[5].invariants = ['TR-99'];
  parsed.examples.push({
    file: 'positive/does-not-exist.json',
    schema: 'cybrik.nope.v1.schema.json',
    kind: 'positive',
  });

  const report = await validateInvestigationLifecycleProposal({
    root: ROOT,
    overrides: asOverride(EXAMPLES_RELATIVE_PATH, parsed),
  });

  for (const fragment of [
    'examples manifest must record the W1-C2 acceptance',
    "unknown fixture kind 'unknown-kind'",
    "unknown fixture invariant id 'TR-99'",
    'fixture or schema missing',
    'fixture-to-runtime-invariant mapping must match',
  ]) {
    assert.ok(report.errors.some((message) => message.includes(fragment)), fragment);
  }
});

test('fixture polarity inversion fails closed in both directions', async () => {
  const report = await validateInvestigationLifecycleProposal({
    root: ROOT,
    overrides: new Map([
      [
        `${FIXTURE_ROOT}negative-schema/investigation-cancel-request.missing-version.json`,
        readPacketText(`${FIXTURE_ROOT}positive/investigation-cancel-request.json`),
      ],
      [`${FIXTURE_ROOT}positive/investigation-checkpoint.json`, '{}\n'],
    ]),
  });

  assert.ok(report.errors.some((message) => message.includes(
    'negative-schema fixture unexpectedly validates',
  )));
  assert.ok(report.errors.some((message) => message.includes(
    'fixture must be structurally valid',
  )));
});

test('every runtime-invariant fixture relationship fails closed when broken', async () => {
  const crossTenant = readPacketJson(
    `${FIXTURE_ROOT}negative-semantic/investigation-create-request.cross-tenant.json`,
  );
  crossTenant.actor.tenant_id = crossTenant.tenant_id;

  const idempotencyConflict = readPacketJson(
    `${FIXTURE_ROOT}negative-semantic/investigation-create-request.idempotency-conflict.json`,
  );
  idempotencyConflict.idempotency_key = 'unrelated-idempotency-key-0001';

  const staleCancel = readPacketJson(
    `${FIXTURE_ROOT}negative-semantic/investigation-cancel-request.stale-version.json`,
  );
  staleCancel.expected_version = 999;

  const terminalCancel = readPacketJson(
    `${FIXTURE_ROOT}negative-semantic/investigation-cancel-request.terminal-race.json`,
  );
  terminalCancel.expected_version = 998;

  const retryCheckpoint = readPacketJson(
    `${FIXTURE_ROOT}negative-semantic/investigation-checkpoint.retry-mutates-terminal-attempt.json`,
  );
  retryCheckpoint.previous_attempt_id = '00000000-0000-4000-8000-000000000099';

  const downgrade = readPacketJson(
    `${FIXTURE_ROOT}negative-semantic/investigation-bundle-read-result.marking-downgrade.json`,
  );
  downgrade.data_marking = JSON.parse(JSON.stringify(downgrade.bundle.data_marking));

  const notFound = readPacketJson(
    `${FIXTURE_ROOT}positive/investigation-lifecycle-error.not-found.json`,
  );
  notFound.message_safe = 'Investigation 42 does not exist in tenant acme.';
  notFound.org_id = 'org-42';

  const existenceLeak = readPacketJson(
    `${FIXTURE_ROOT}negative-schema/investigation-lifecycle-error.existence-leak.json`,
  );
  delete existenceLeak.resource_exists;

  const overrides = new Map([
    [`${FIXTURE_ROOT}negative-semantic/investigation-create-request.cross-tenant.json`, `${JSON.stringify(crossTenant, null, 2)}\n`],
    [`${FIXTURE_ROOT}negative-semantic/investigation-create-request.idempotency-conflict.json`, `${JSON.stringify(idempotencyConflict, null, 2)}\n`],
    [`${FIXTURE_ROOT}negative-semantic/investigation-cancel-request.stale-version.json`, `${JSON.stringify(staleCancel, null, 2)}\n`],
    [`${FIXTURE_ROOT}negative-semantic/investigation-cancel-request.terminal-race.json`, `${JSON.stringify(terminalCancel, null, 2)}\n`],
    [`${FIXTURE_ROOT}negative-semantic/investigation-checkpoint.retry-mutates-terminal-attempt.json`, `${JSON.stringify(retryCheckpoint, null, 2)}\n`],
    [`${FIXTURE_ROOT}negative-semantic/investigation-bundle-read-result.marking-downgrade.json`, `${JSON.stringify(downgrade, null, 2)}\n`],
    [`${FIXTURE_ROOT}positive/investigation-lifecycle-error.not-found.json`, `${JSON.stringify(notFound, null, 2)}\n`],
    [`${FIXTURE_ROOT}negative-schema/investigation-lifecycle-error.existence-leak.json`, `${JSON.stringify(existenceLeak, null, 2)}\n`],
  ]);

  const report = await validateInvestigationLifecycleProposal({ root: ROOT, overrides });

  for (const fragment of [
    'TR-1 fixture must embody a body/actor tenant mismatch',
    'TR-3 fixture must reuse principal/key with different normalized content',
    'TR-4 stale-cancel fixture must be older than authoritative status',
    'TR-4/TR-5 terminal-race fixture must target the current terminal version',
    'TR-5/TR-6 retry fixture must embody self-link plus non-reset sequence',
    'TR-7 fixture must embody a bundle wrapper marking downgrade',
    'TR-8 positive fixture must use the constant sanitized no-existence response',
    'TR-8 positive fixture must carry no target, tenant, org, owner, or policy identifiers',
    'TR-8 negative fixture must be the exact resource-existence disclosure decoy',
  ]) {
    assert.ok(report.errors.some((message) => message.includes(fragment)), fragment);
  }
});
