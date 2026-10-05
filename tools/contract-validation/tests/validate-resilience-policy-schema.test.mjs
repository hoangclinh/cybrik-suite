// Resilience policy schema conformance tests.
//
// contracts/json-schema/cybrik.resilience-policy.v1.schema.json is checked here, under
// the contract validators' Ajv, instead of by jsonschema in the SDK's pytest suite: the
// SDK's locked test environment does not carry jsonschema. The cases are the ones the
// SDK's three schema tests used, payload for payload, plus one negative case for each
// other required member, property and item type, bound and additionalProperties.
//
// The Ajv instance is built exactly as validate-schemas.mjs builds its own. The first
// test reads that file's source and fails if its setup and the copy below differ.
// validate-schemas.mjs is read, not imported: importing it runs the whole validator.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

import AjvModule from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';

const Ajv2020 = AjvModule.default || AjvModule;
const addFormats = addFormatsModule.default || addFormatsModule;

const TOOL_ROOT = resolve(import.meta.dirname, '..');
const REPO_ROOT = resolve(TOOL_ROOT, '../..');
const SCHEMA_PATH = join(REPO_ROOT, 'contracts/json-schema/cybrik.resilience-policy.v1.schema.json');
const VALIDATOR_PATH = join(TOOL_ROOT, 'validate-schemas.mjs');

// Copied from validate-schemas.mjs (constructor, addFormats, annotation keyword loop).
const AJV_OPTIONS = { strict: true, strictTypes: false, strictRequired: false, allErrors: true, allowUnionTypes: true };
const ANNOTATION_KEYWORDS = ['x-cybrik-status', 'x-cybrik-not-accepted', 'x-cybrik-contract-version', 'x-cybrik-format-pins', 'x-cybrik-lifecycle'];

const createAjv = () => {
  const ajv = new Ajv2020(AJV_OPTIONS);
  addFormats(ajv);
  for (const keyword of ANNOTATION_KEYWORDS) {
    ajv.addKeyword({ keyword });
  }
  return ajv;
};

const loadSchema = () => JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
const compileSchema = () => createAjv().compile(loadSchema());
const valueAt = (payload, instancePath) =>
  instancePath.split('/').slice(1).reduce((value, key) => value[key], payload);

const VALID_CIRCUIT_BREAKER = { failure_threshold: 5, recovery_timeout_seconds: 30.0 };

const POSITIVES = [
  {
    name: 'minimal (required fields only)',
    payload: {
      max_retries: 3,
      initial_backoff_seconds: 0.5,
      max_backoff_seconds: 30.0,
      circuit_breaker: { failure_threshold: 5, recovery_timeout_seconds: 30.0 },
    },
  },
  {
    name: 'complete (all fields)',
    payload: {
      max_retries: 5,
      initial_backoff_seconds: 1.0,
      max_backoff_seconds: 60.0,
      backoff_multiplier: 2.5,
      jitter: true,
      circuit_breaker: {
        failure_threshold: 10,
        recovery_timeout_seconds: 45.0,
        half_open_max_calls: 5,
        consecutive_successes_to_close: 3,
      },
      retryable_status_codes: [429, 502, 503, 504],
      retryable_exceptions: ['TimeoutError', 'ConnectionError', 'ServiceUnavailableError'],
    },
  },
];

// One row per jsonschema assertion the SDK test made; `jsonschema` is its match= text.
// Ajv reports one error per case. Where that text names the offending value, instanceValue
// carries it, because Ajv errors do not include the data.
const NEGATIVES = [
  {
    name: 'missing circuit_breaker',
    jsonschema: "'circuit_breaker' is a required property",
    payload: { max_retries: 3, initial_backoff_seconds: 0.5, max_backoff_seconds: 30.0 },
    keyword: 'required',
    instancePath: '',
    params: { missingProperty: 'circuit_breaker' },
  },
  {
    name: 'max_retries above 10',
    jsonschema: '11 is greater than the maximum of 10',
    payload: { max_retries: 11, initial_backoff_seconds: 0.5, max_backoff_seconds: 30.0, circuit_breaker: VALID_CIRCUIT_BREAKER },
    keyword: 'maximum',
    instancePath: '/max_retries',
    params: { comparison: '<=', limit: 10 },
    instanceValue: 11,
  },
  {
    name: 'initial_backoff_seconds below 0.01',
    jsonschema: 'is less than the minimum of 0.01',
    payload: { max_retries: 3, initial_backoff_seconds: 0.005, max_backoff_seconds: 30.0, circuit_breaker: VALID_CIRCUIT_BREAKER },
    keyword: 'minimum',
    instancePath: '/initial_backoff_seconds',
    params: { comparison: '>=', limit: 0.01 },
  },
  {
    name: 'circuit_breaker.failure_threshold below 1',
    jsonschema: '0 is less than the minimum of 1',
    payload: {
      max_retries: 3,
      initial_backoff_seconds: 0.5,
      max_backoff_seconds: 30.0,
      circuit_breaker: { failure_threshold: 0, recovery_timeout_seconds: 30.0 },
    },
    keyword: 'minimum',
    instancePath: '/circuit_breaker/failure_threshold',
    params: { comparison: '>=', limit: 1 },
    instanceValue: 0,
  },
  {
    name: 'an additional property',
    jsonschema: 'Additional properties are not allowed',
    payload: {
      max_retries: 3,
      initial_backoff_seconds: 0.5,
      max_backoff_seconds: 30.0,
      circuit_breaker: VALID_CIRCUIT_BREAKER,
      unauthorized_field: 'disallowed',
    },
    keyword: 'additionalProperties',
    instancePath: '',
    params: { additionalProperty: 'unauthorized_field' },
  },
];

// One row for each required member, property and item type, bound and additionalProperties
// of the schema that the rows above do not already break. Each payload is the minimal
// positive with one change, so it breaks exactly that constraint: deleting the constraint
// from the schema turns exactly that row's test red.
const MINIMAL = POSITIVES[0].payload;
const omit = (object, key) => Object.fromEntries(Object.entries(object).filter(([name]) => name !== key));
const withRoot = (change) => ({ ...MINIMAL, ...change });
const withBreaker = (change) => withRoot({ circuit_breaker: { ...MINIMAL.circuit_breaker, ...change } });
const withoutBreaker = (key) => withRoot({ circuit_breaker: omit(MINIMAL.circuit_breaker, key) });

// Each helper takes the instancePath Ajv reports, and names the test after it.
const dotted = (instancePath) => instancePath.slice(1).replaceAll('/', '.');
const isRequired = (instancePath, missingProperty, payload) => ({
  name: `missing ${[dotted(instancePath), missingProperty].filter(Boolean).join('.')}`,
  payload, keyword: 'required', instancePath, params: { missingProperty },
});
const isType = (instancePath, payload, type) => ({
  name: `${dotted(instancePath)} not of type ${type}`, payload, keyword: 'type', instancePath, params: { type },
});
const isBelow = (instancePath, payload, limit) => ({
  name: `${dotted(instancePath)} below ${limit}`,
  payload, keyword: 'minimum', instancePath, params: { comparison: '>=', limit },
});
const isAbove = (instancePath, payload, limit) => ({
  name: `${dotted(instancePath)} above ${limit}`,
  payload, keyword: 'maximum', instancePath, params: { comparison: '<=', limit },
});

const CONSTRAINT_NEGATIVES = [
  isRequired('', 'max_retries', omit(MINIMAL, 'max_retries')),
  isRequired('', 'initial_backoff_seconds', omit(MINIMAL, 'initial_backoff_seconds')),
  isRequired('', 'max_backoff_seconds', omit(MINIMAL, 'max_backoff_seconds')),
  isRequired('/circuit_breaker', 'failure_threshold', withoutBreaker('failure_threshold')),
  isRequired('/circuit_breaker', 'recovery_timeout_seconds', withoutBreaker('recovery_timeout_seconds')),

  isType('/max_retries', withRoot({ max_retries: 2.5 }), 'integer'),
  isType('/initial_backoff_seconds', withRoot({ initial_backoff_seconds: '0.5' }), 'number'),
  isType('/max_backoff_seconds', withRoot({ max_backoff_seconds: '30' }), 'number'),
  isType('/backoff_multiplier', withRoot({ backoff_multiplier: '2' }), 'number'),
  isType('/jitter', withRoot({ jitter: 'true' }), 'boolean'),
  isType('/circuit_breaker', withRoot({ circuit_breaker: 'closed' }), 'object'),
  isType('/retryable_status_codes', withRoot({ retryable_status_codes: 503 }), 'array'),
  isType('/retryable_exceptions', withRoot({ retryable_exceptions: 'TimeoutError' }), 'array'),
  isType('/circuit_breaker/failure_threshold', withBreaker({ failure_threshold: 2.5 }), 'integer'),
  isType('/circuit_breaker/recovery_timeout_seconds', withBreaker({ recovery_timeout_seconds: '30' }), 'number'),
  isType('/circuit_breaker/half_open_max_calls', withBreaker({ half_open_max_calls: 2.5 }), 'integer'),
  isType('/circuit_breaker/consecutive_successes_to_close', withBreaker({ consecutive_successes_to_close: 1.5 }), 'integer'),
  isType('/retryable_status_codes/0', withRoot({ retryable_status_codes: ['503'] }), 'integer'),
  isType('/retryable_exceptions/0', withRoot({ retryable_exceptions: [503] }), 'string'),

  isBelow('/max_retries', withRoot({ max_retries: -1 }), 0),
  isAbove('/initial_backoff_seconds', withRoot({ initial_backoff_seconds: 60.5 }), 60),
  isBelow('/max_backoff_seconds', withRoot({ max_backoff_seconds: 0.05 }), 0.1),
  isAbove('/max_backoff_seconds', withRoot({ max_backoff_seconds: 300.5 }), 300),
  isBelow('/backoff_multiplier', withRoot({ backoff_multiplier: 0.5 }), 1),
  isAbove('/backoff_multiplier', withRoot({ backoff_multiplier: 5.5 }), 5),
  isAbove('/circuit_breaker/failure_threshold', withBreaker({ failure_threshold: 101 }), 100),
  isBelow('/circuit_breaker/recovery_timeout_seconds', withBreaker({ recovery_timeout_seconds: 0.5 }), 1),
  isAbove('/circuit_breaker/recovery_timeout_seconds', withBreaker({ recovery_timeout_seconds: 600.5 }), 600),
  isBelow('/circuit_breaker/half_open_max_calls', withBreaker({ half_open_max_calls: 0 }), 1),
  isAbove('/circuit_breaker/half_open_max_calls', withBreaker({ half_open_max_calls: 21 }), 20),
  isBelow('/circuit_breaker/consecutive_successes_to_close', withBreaker({ consecutive_successes_to_close: 0 }), 1),
  isAbove('/circuit_breaker/consecutive_successes_to_close', withBreaker({ consecutive_successes_to_close: 21 }), 20),

  {
    name: 'an additional circuit_breaker property',
    payload: withBreaker({ unauthorized_field: 'disallowed' }),
    keyword: 'additionalProperties',
    instancePath: '/circuit_breaker',
    params: { additionalProperty: 'unauthorized_field' },
  },
];

// Each element must occur exactly once: none means the setup moved, two means a second instance.
const occurrences = (source, needle) => source.split(needle).length - 1;
const onlyMatch = (source, pattern, label) => {
  const matches = [...source.matchAll(pattern)];
  assert.equal(matches.length, 1, `validate-schemas.mjs: expected exactly one ${label}, found ${matches.length}`);
  return matches[0];
};
const parseBooleanOptions = (text) =>
  Object.fromEntries(text.split(',').map((entry) => {
    const option = /^\s*(\w+):\s*(true|false)\s*$/.exec(entry);
    assert.ok(option, `validate-schemas.mjs: Ajv2020 option is not a boolean literal: ${entry.trim()}`);
    return [option[1], option[2] === 'true'];
  }));

test('the Ajv setup is the one validate-schemas.mjs uses', () => {
  const source = readFileSync(VALIDATOR_PATH, 'utf8');
  for (const needle of ['new Ajv2020(', 'addFormats(', 'addKeyword(', 'for (const kw of [']) {
    assert.equal(occurrences(source, needle), 1, `validate-schemas.mjs: expected exactly one "${needle}"`);
  }

  const constructor = onlyMatch(source, /^const ajv = new Ajv2020\(\{([^{}]*)\}\);$/gm, 'Ajv2020 constructor');
  assert.deepEqual(parseBooleanOptions(constructor[1]), AJV_OPTIONS);
  onlyMatch(source, /^addFormats\(ajv\);$/gm, 'addFormats(ajv) call');
  const keywordLoop = onlyMatch(
    source,
    /^for \(const kw of (\[[^\]]*\])\) \{\n {2}ajv\.addKeyword\(\{ keyword: kw \}\);\n\}$/gm,
    'annotation keyword loop',
  );
  assert.deepEqual(JSON.parse(keywordLoop[1].replaceAll("'", '"')), ANNOTATION_KEYWORDS);
});

test('the resilience policy schema conforms to Draft 2020-12', () => {
  const schema = loadSchema();
  const ajv = createAjv();

  assert.equal(ajv.validateSchema(schema), true, JSON.stringify(ajv.errors));
  assert.doesNotThrow(() => ajv.compile(schema));

  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(
    schema.$id,
    'https://schema.cybrik.dev/contracts/json-schema/cybrik.resilience-policy.v1.schema.json',
  );
  assert.equal(schema.title, 'CYBRIK Resilience Policy Contract Schema');
  assert.equal(schema['x-cybrik-status'], 'ACCEPTED FOR IMPLEMENTATION');
  assert.equal(schema.type, 'object');
  assert.equal(schema.additionalProperties, false);
  assert.ok(ANNOTATION_KEYWORDS.includes('x-cybrik-status'));
});

test('the resilience policy schema accepts the minimal and complete instances', () => {
  const validate = compileSchema();
  for (const { name, payload } of POSITIVES) {
    assert.equal(validate(payload), true, `${name}: ${JSON.stringify(validate.errors)}`);
  }
});

for (const negative of [...NEGATIVES, ...CONSTRAINT_NEGATIVES]) {
  test(`the resilience policy schema rejects ${negative.name}`, () => {
    const validate = compileSchema();

    assert.equal(validate(negative.payload), false);
    assert.equal(validate.errors.length, 1, JSON.stringify(validate.errors));
    const [error] = validate.errors;
    assert.equal(error.keyword, negative.keyword);
    assert.equal(error.instancePath, negative.instancePath);
    assert.deepEqual(error.params, negative.params);
    if ('instanceValue' in negative) {
      assert.equal(valueAt(negative.payload, negative.instancePath), negative.instanceValue);
    }
  });
}
