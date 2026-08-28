// validate-schemas.mjs — JSON Schema 2020-12 conformance + packet integrity + security invariants.
//
// Covers (see README "Coverage"): standards metastructure, cross-file/local $ref + fragment
// resolution, positive examples, intended negative-schema fixtures, negative-semantic fixtures,
// the compatibility manifest + examples manifest (member/status/version honesty), and the 10
// hardening security invariants encoded as explicit assertions so they cannot be silently relaxed.
//
// Wire specs (OpenAPI 3.1.x, AsyncAPI 3.0.0) are validated by validate-openapi.mjs /
// validate-asyncapi.mjs; here we parse those two YAML files ONLY to (a) resolve their external
// $refs into the json-schema packet and (b) assert two hardenings that live in them.
//
// Zero external side effects. Exit 0 = all checks passed; exit 1 = at least one failure.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, basename, sep, posix } from 'node:path';
import AjvModule from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { parse as parseYaml } from 'yaml';

const Ajv2020 = AjvModule.default || AjvModule;
const addFormats = addFormatsModule.default || addFormatsModule;

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..'); // tools/contract-validation -> repo root
const CONTRACTS = join(ROOT, 'contracts');
const JSON_SCHEMA_DIR = join(CONTRACTS, 'json-schema');

const DRAFT_2020 = 'https://json-schema.org/draft/2020-12/schema';
const ID_PREFIX = 'https://contracts.cybrik.example/';
const EXPECTED_VERSION = '0.1.0';
const EXPECTED_PACKET_VERSION = '0.1.1';
const CAPABILITY_VERSION = '0.1.1';
const CAPABILITY_FILE = 'json-schema/cybrik.capability.v1.schema.json';

const errors = [];
const notes = [];
const counts = {};
const fail = (m) => errors.push(m);
const bump = (k, n = 1) => { counts[k] = (counts[k] || 0) + n; };

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const readYaml = (p) => parseYaml(readFileSync(p, 'utf8'));

function validateStringSurrogates(str, label) {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0xD800 && code <= 0xDBFF) {
      if (i + 1 < str.length) {
        const nextCode = str.charCodeAt(i + 1);
        if (nextCode >= 0xDC00 && nextCode <= 0xDFFF) {
          i++; // Skip low surrogate of valid surrogate pair
          continue;
        }
      }
      const hex = code.toString(16).toUpperCase().padStart(4, '0');
      throw new Error(`I-JSON Error in ${label}: lone or unpaired surrogate code point U+${hex} prohibited by RFC 7493 / RFC 8785`);
    } else if (code >= 0xDC00 && code <= 0xDFFF) {
      const hex = code.toString(16).toUpperCase().padStart(4, '0');
      throw new Error(`I-JSON Error in ${label}: lone or unpaired surrogate code point U+${hex} prohibited by RFC 7493 / RFC 8785`);
    }
  }
}

function validateEscapedSurrogates(rawJsonText, label) {
  let i = 0;
  const len = rawJsonText.length;
  while (i < len) {
    if (rawJsonText[i] === '\\') {
      let bsCount = 0;
      while (i + bsCount < len && rawJsonText[i + bsCount] === '\\') {
        bsCount++;
      }
      const nextIdx = i + bsCount;
      if (bsCount % 2 === 1 && nextIdx < len) {
        const escChar = rawJsonText[nextIdx];
        if (escChar === 'u' || escChar === 'U') {
          const hexStr = rawJsonText.slice(nextIdx + 1, nextIdx + 5);
          if (/^[0-9a-fA-F]{4}$/.test(hexStr)) {
            const codePoint = parseInt(hexStr, 16);
            if (codePoint >= 0xD800 && codePoint <= 0xDBFF) {
              // High surrogate: MUST be immediately followed by an escaped low surrogate \uDC00..\uDFFF (with parity 1 backslash)
              if (
                nextIdx + 10 < len &&
                rawJsonText[nextIdx + 5] === '\\' &&
                (rawJsonText[nextIdx + 6] === 'u' || rawJsonText[nextIdx + 6] === 'U')
              ) {
                const lowHexStr = rawJsonText.slice(nextIdx + 7, nextIdx + 11);
                if (/^[0-9a-fA-F]{4}$/.test(lowHexStr)) {
                  const lowCodePoint = parseInt(lowHexStr, 16);
                  if (lowCodePoint >= 0xDC00 && lowCodePoint <= 0xDFFF) {
                    // Valid surrogate pair escape sequence: advance past both \uXXXX escapes
                    i = nextIdx + 11;
                    continue;
                  }
                }
              }
              throw new Error(`I-JSON Error in ${label}: escaped lone surrogate code point prohibited by RFC 7493 / RFC 8785`);
            } else if (codePoint >= 0xDC00 && codePoint <= 0xDFFF) {
              throw new Error(`I-JSON Error in ${label}: escaped lone surrogate code point prohibited by RFC 7493 / RFC 8785`);
            }
            i = nextIdx + 5;
            continue;
          }
        }
      }
      i = nextIdx;
    } else {
      i++;
    }
  }
}

function scanValueSurrogates(val, label) {
  if (typeof val === 'string') {
    validateStringSurrogates(val, label);
  } else if (Array.isArray(val)) {
    for (const item of val) {
      scanValueSurrogates(item, label);
    }
  } else if (val !== null && typeof val === 'object') {
    for (const [k, v] of Object.entries(val)) {
      validateStringSurrogates(k, label);
      scanValueSurrogates(v, label);
    }
  }
}

export function validateIJson(bufferOrString, label = 'JSON') {
  let rawJsonText;
  if (typeof bufferOrString === 'string') {
    rawJsonText = bufferOrString;
  } else if (Buffer.isBuffer(bufferOrString) || bufferOrString instanceof Uint8Array) {
    try {
      rawJsonText = new TextDecoder('utf-8', { fatal: true }).decode(bufferOrString);
    } catch (e) {
      throw new Error(`${label}: fatal I-JSON validation error: malformed UTF-8 byte sequence: ${e.message}`);
    }
  } else {
    throw new Error(`${label}: expected string or Buffer for I-JSON validation`);
  }

  // Reject UTF-8 BOM
  if (rawJsonText.charCodeAt(0) === 0xFEFF) {
    throw new Error(`${label}: I-JSON violation: Byte Order Mark (BOM) is prohibited`);
  }

  // Reject raw unescaped lone surrogate code points in input string
  validateStringSurrogates(rawJsonText, label);

  // Reject escaped lone surrogate code points prohibited by RFC 7493 / RFC 8785
  validateEscapedSurrogates(rawJsonText, label);

  let pos = 0;
  const len = rawJsonText.length;

  function skipWhitespace() {
    while (pos < len) {
      const ch = rawJsonText.charCodeAt(pos);
      if (ch === 0x20 || ch === 0x09 || ch === 0x0A || ch === 0x0D) {
        pos++;
      } else {
        break;
      }
    }
  }

  function parseString() {
    const start = pos;
    if (rawJsonText[pos] !== '"') {
      throw new Error(`${label}: Expected '"' at position ${pos}`);
    }
    pos++;
    while (pos < len) {
      const ch = rawJsonText[pos];
      if (ch === '"') {
        pos++;
        const strSlice = rawJsonText.slice(start, pos);
        const parsed = JSON.parse(strSlice);
        validateStringSurrogates(parsed, label);
        return parsed;
      }
      if (ch === '\\') {
        pos += 2;
      } else {
        if (ch.charCodeAt(0) < 0x20) {
          throw new Error(`${label}: Unescaped control character in string at position ${pos}`);
        }
        pos++;
      }
    }
    throw new Error(`${label}: Unterminated string at position ${pos}`);
  }

  function parseNumber() {
    const start = pos;
    if (rawJsonText[pos] === '-') pos++;
    if (pos >= len) throw new Error(`${label}: Invalid number at position ${start}`);

    if (rawJsonText[pos] === '0') {
      pos++;
    } else if (rawJsonText[pos] >= '1' && rawJsonText[pos] <= '9') {
      while (pos < len && rawJsonText[pos] >= '0' && rawJsonText[pos] <= '9') {
        pos++;
      }
    } else {
      throw new Error(`${label}: Invalid number format at position ${start}`);
    }

    let isFloat = false;
    if (pos < len && rawJsonText[pos] === '.') {
      isFloat = true;
      pos++;
      if (pos >= len || rawJsonText[pos] < '0' || rawJsonText[pos] > '9') {
        throw new Error(`${label}: Invalid decimal number at position ${start}`);
      }
      while (pos < len && rawJsonText[pos] >= '0' && rawJsonText[pos] <= '9') {
        pos++;
      }
    }

    if (pos < len && (rawJsonText[pos] === 'e' || rawJsonText[pos] === 'E')) {
      isFloat = true;
      pos++;
      if (pos < len && (rawJsonText[pos] === '+' || rawJsonText[pos] === '-')) {
        pos++;
      }
      if (pos >= len || rawJsonText[pos] < '0' || rawJsonText[pos] > '9') {
        throw new Error(`${label}: Invalid exponent in number at position ${start}`);
      }
      while (pos < len && rawJsonText[pos] >= '0' && rawJsonText[pos] <= '9') {
        pos++;
      }
    }

    const numStr = rawJsonText.slice(start, pos);

    // I-JSON (RFC 7493 §2.1) + Specification §3.1 Invariant:
    // Numbers MUST be exact integers within IEEE-754 double safe integer range: [-(2^53 - 1), 2^53 - 1]
    // i.e. [-9007199254740991, 9007199254740991].
    // Floating-point values, scientific notation, or numbers outside this range MUST be rejected.
    if (isFloat) {
      throw new Error(`${label}: I-JSON violation: floating-point or scientific notation number '${numStr}' is prohibited; exact integers only`);
    }

    const bigNum = BigInt(numStr);
    const MIN_SAFE = -9007199254740991n; // -(2^53 - 1)
    const MAX_SAFE = 9007199254740991n;  // 2^53 - 1
    if (bigNum < MIN_SAFE || bigNum > MAX_SAFE) {
      throw new Error(`${label}: I-JSON violation: integer ${numStr} exceeds IEEE-754 safe integer range [-(2^53-1), 2^53-1]`);
    }

    return Number(bigNum);
  }

  function parseObject() {
    pos++; // skip '{'
    skipWhitespace();
    const seenKeys = new Set();
    const obj = {};

    if (pos < len && rawJsonText[pos] === '}') {
      pos++;
      return obj;
    }

    while (pos < len) {
      skipWhitespace();
      if (rawJsonText[pos] !== '"') {
        throw new Error(`${label}: Expected string key at position ${pos}`);
      }
      const key = parseString();
      if (seenKeys.has(key)) {
        throw new Error(`${label}: I-JSON violation: duplicate object key '${key}' detected`);
      }
      seenKeys.add(key);

      skipWhitespace();
      if (rawJsonText[pos] !== ':') {
        throw new Error(`${label}: Expected ':' after key '${key}' at position ${pos}`);
      }
      pos++; // skip ':'

      skipWhitespace();
      const val = parseValue();
      obj[key] = val;

      skipWhitespace();
      if (rawJsonText[pos] === '}') {
        pos++;
        return obj;
      }
      if (rawJsonText[pos] === ',') {
        pos++;
        continue;
      }
      throw new Error(`${label}: Expected ',' or '}' in object at position ${pos}`);
    }
    throw new Error(`${label}: Unterminated object at position ${pos}`);
  }

  function parseArray() {
    pos++; // skip '['
    skipWhitespace();
    const arr = [];

    if (pos < len && rawJsonText[pos] === ']') {
      pos++;
      return arr;
    }

    while (pos < len) {
      skipWhitespace();
      const val = parseValue();
      arr.push(val);

      skipWhitespace();
      if (rawJsonText[pos] === ']') {
        pos++;
        return arr;
      }
      if (rawJsonText[pos] === ',') {
        pos++;
        continue;
      }
      throw new Error(`${label}: Expected ',' or ']' in array at position ${pos}`);
    }
    throw new Error(`${label}: Unterminated array at position ${pos}`);
  }

  function parseValue() {
    skipWhitespace();
    if (pos >= len) throw new Error(`${label}: Unexpected end of input`);

    const ch = rawJsonText[pos];
    if (ch === '{') return parseObject();
    if (ch === '[') return parseArray();
    if (ch === '"') return parseString();
    if (ch === '-' || (ch >= '0' && ch <= '9')) return parseNumber();
    if (rawJsonText.startsWith('true', pos)) { pos += 4; return true; }
    if (rawJsonText.startsWith('false', pos)) { pos += 5; return false; }
    if (rawJsonText.startsWith('null', pos)) { pos += 4; return null; }

    throw new Error(`${label}: Unexpected token '${ch}' at position ${pos}`);
  }

  skipWhitespace();
  const result = parseValue();
  skipWhitespace();
  if (pos < len) {
    throw new Error(`${label}: Trailing characters after JSON root at position ${pos}`);
  }
  scanValueSurrogates(result, label);
  return result;
}

export function isMalformedBase64Md5(headerVal) {
  if (typeof headerVal !== 'string') return true;
  const trimmed = headerVal.trim();
  if (!trimmed) return true;
  if (!/^[A-Za-z0-9+/]{22}==$/.test(trimmed)) return true;
  try {
    const buf = Buffer.from(trimmed, 'base64');
    return buf.length !== 16 || buf.toString('base64') !== trimmed;
  } catch {
    return true;
  }
}

export function computePayloadMd5(payloadBytes) {
  const payload = payloadBytes !== undefined && payloadBytes !== null
    ? (Buffer.isBuffer(payloadBytes) || payloadBytes instanceof Uint8Array
        ? payloadBytes
        : Buffer.from(payloadBytes))
    : Buffer.alloc(0);
  return createHash('md5').update(payload).digest('base64');
}

export function computePayloadSha256(payloadBytes) {
  const payload = payloadBytes !== undefined && payloadBytes !== null
    ? (Buffer.isBuffer(payloadBytes) || payloadBytes instanceof Uint8Array
        ? payloadBytes
        : Buffer.from(payloadBytes))
    : Buffer.alloc(0);
  return createHash('sha256').update(payload).digest('hex');
}

export function isMalformedSha256(headerVal) {
  if (typeof headerVal !== 'string') return true;
  return !/^[0-9a-f]{64}$/.test(headerVal);
}

export function dispatchS3PutObject(optionsOrPayload = {}, maybeMd5Header, maybeSha256Header) {
  let payloadBytes;
  let md5Val;
  let sha256Val;

  if (optionsOrPayload && typeof optionsOrPayload === 'object' && !Buffer.isBuffer(optionsOrPayload) && !(optionsOrPayload instanceof Uint8Array)) {
    payloadBytes = optionsOrPayload.payloadBytes ?? optionsOrPayload.payload ?? optionsOrPayload.body;
    md5Val = optionsOrPayload.contentMd5Header ?? optionsOrPayload.content_md5_header ?? optionsOrPayload.contentMd5 ?? optionsOrPayload['Content-MD5'] ?? optionsOrPayload.content_md5;
    sha256Val = optionsOrPayload['x-amz-content-sha256'] ?? optionsOrPayload['X-Amz-Content-Sha256'] ?? optionsOrPayload.contentSha256Header ?? optionsOrPayload.content_sha256_header ?? optionsOrPayload.contentSha256 ?? optionsOrPayload.xAmzContentSha256 ?? optionsOrPayload.x_amz_content_sha256 ?? optionsOrPayload.sha256Header ?? (optionsOrPayload.headers ? (optionsOrPayload.headers['x-amz-content-sha256'] ?? optionsOrPayload.headers['X-Amz-Content-Sha256']) : undefined);
  } else {
    payloadBytes = optionsOrPayload;
    md5Val = maybeMd5Header;
    sha256Val = maybeSha256Header;
  }

  if (payloadBytes === undefined || payloadBytes === null) {
    return { http_status: 400, error_code: 'InvalidDigest', status: 400, code: 'InvalidDigest', reason: 'MISSING_PAYLOAD' };
  }

  if (sha256Val === undefined || sha256Val === null || sha256Val === '') {
    return { http_status: 400, error_code: 'InvalidDigest', status: 400, code: 'InvalidDigest', reason: 'MissingXAmzContentSHA256' };
  }

  if (typeof sha256Val !== 'string') {
    return { http_status: 400, error_code: 'InvalidDigest', status: 400, code: 'InvalidDigest', reason: 'MALFORMED_HEADER_SYNTAX' };
  }

  if (sha256Val === 'UNSIGNED-PAYLOAD') {
    // allow
  } else if (sha256Val.startsWith('STREAMING-')) {
    return { http_status: 400, error_code: 'InvalidDigest', status: 400, code: 'InvalidDigest', reason: 'MALFORMED_HEADER_SYNTAX' };
  } else {
    if (isMalformedSha256(sha256Val)) {
      return { http_status: 400, error_code: 'InvalidDigest', status: 400, code: 'InvalidDigest', reason: 'MALFORMED_HEADER_SYNTAX' };
    }
    const calculatedSha256 = computePayloadSha256(payloadBytes);
    if (calculatedSha256 !== sha256Val) {
      return { http_status: 400, error_code: 'BadDigest', status: 400, code: 'BadDigest', reason: 'PAYLOAD_SHA256_MISMATCH' };
    }
  }

  const hasMd5 = (optionsOrPayload && typeof optionsOrPayload === 'object' && !Buffer.isBuffer(optionsOrPayload) && !(optionsOrPayload instanceof Uint8Array))
    ? ('contentMd5Header' in optionsOrPayload || 'content_md5_header' in optionsOrPayload || 'contentMd5' in optionsOrPayload || 'Content-MD5' in optionsOrPayload || 'content_md5' in optionsOrPayload || (optionsOrPayload.headers && ('Content-MD5' in optionsOrPayload.headers || 'content-md5' in optionsOrPayload.headers)))
    : (maybeMd5Header !== undefined);

  if (hasMd5) {
    if (isMalformedBase64Md5(md5Val)) {
      return { http_status: 400, error_code: 'InvalidDigest', status: 400, code: 'InvalidDigest', reason: 'MALFORMED_HEADER_SYNTAX' };
    }
    const calculatedMd5 = computePayloadMd5(payloadBytes);
    if (calculatedMd5 !== (typeof md5Val === 'string' ? md5Val.trim() : '')) {
      return { http_status: 400, error_code: 'BadDigest', status: 400, code: 'BadDigest', reason: 'PAYLOAD_DIGEST_MISMATCH' };
    }
  }

  return { http_status: 200, error_code: null, status: 200, code: null };
}

export function dispatchS3CompleteMultipartUpload(manifestOrOptions = {}, maybeStoredParts) {
  let manifest;
  let storedParts;

  if (manifestOrOptions && typeof manifestOrOptions === 'object') {
    if (manifestOrOptions.manifest && typeof manifestOrOptions.manifest === 'object') {
      manifest = manifestOrOptions.manifest;
      storedParts = maybeStoredParts !== undefined ? maybeStoredParts : manifestOrOptions.storedParts;
    } else if (Array.isArray(manifestOrOptions)) {
      manifest = { parts: manifestOrOptions };
      storedParts = maybeStoredParts;
    } else if (manifestOrOptions.parts !== undefined) {
      manifest = manifestOrOptions;
      storedParts = maybeStoredParts !== undefined ? maybeStoredParts : manifestOrOptions.storedParts;
    } else {
      manifest = manifestOrOptions;
      storedParts = maybeStoredParts !== undefined ? maybeStoredParts : manifestOrOptions.storedParts;
    }
  } else {
    manifest = manifestOrOptions;
    storedParts = maybeStoredParts;
  }

  if (!manifest || !manifest.parts || !Array.isArray(manifest.parts) || manifest.parts.length === 0) {
    return { http_status: 400, error_code: 'InvalidArgument', status: 400, code: 'InvalidArgument', reason: 'EmptyPartsList' };
  }

  if (manifest.parts.length > 10000) {
    return { http_status: 400, error_code: 'InvalidArgument', status: 400, code: 'InvalidArgument', reason: 'TooManyParts' };
  }

  let prevNum = 0;
  for (let i = 0; i < manifest.parts.length; i++) {
    const p = manifest.parts[i];
    const pNum = p ? (p.part_number ?? p.PartNumber) : undefined;
    if (typeof pNum !== 'number' || pNum < 1 || pNum > 10000 || !Number.isInteger(pNum)) {
      return { http_status: 400, error_code: 'InvalidArgument', status: 400, code: 'InvalidArgument', reason: 'InvalidPartNumber' };
    }
    if (pNum <= prevNum) {
      return {
        http_status: 400,
        error_code: 'InvalidPartOrder',
        status: 400,
        code: 'InvalidPartOrder',
        reason: pNum === prevNum ? 'DUPLICATE_PART' : 'PARTS_NOT_ASCENDING',
      };
    }
    prevNum = pNum;
  }

  if (!storedParts || (typeof storedParts !== 'object' && !Array.isArray(storedParts))) {
    return { http_status: 400, error_code: 'InvalidPart', status: 400, code: 'InvalidPart', reason: 'MissingStoredPartState' };
  }

  const storedMap = Array.isArray(storedParts)
    ? new Map(storedParts.map((p, idx) => [p ? (p.part_number ?? p.PartNumber ?? (idx + 1)) : (idx + 1), p]))
    : (storedParts instanceof Map
        ? storedParts
        : new Map(Object.entries(storedParts || {}).map(([k, v]) => [Number(k), v])));

  let totalSizeBytes = 0;
  for (let i = 0; i < manifest.parts.length; i++) {
    const part = manifest.parts[i];
    const pNum = part ? (part.part_number ?? part.PartNumber) : undefined;

    const manifestEtag = part ? (part.etag !== undefined ? part.etag : part.ETag) : undefined;
    if (!part || typeof manifestEtag !== 'string' || manifestEtag.trim() === '') {
      return { http_status: 400, error_code: 'InvalidPart', status: 400, code: 'InvalidPart', reason: 'MissingManifestPartETag' };
    }

    if (!storedMap.has(pNum)) {
      return { http_status: 400, error_code: 'InvalidPart', status: 400, code: 'InvalidPart', reason: 'MissingStoredPartETag' };
    }

    const storedPart = storedMap.get(pNum);
    const storedEtag = storedPart ? (storedPart.etag !== undefined ? storedPart.etag : storedPart.ETag) : undefined;
    if (!storedPart || typeof storedPart !== 'object' || typeof storedEtag !== 'string' || storedEtag.trim() === '') {
      return { http_status: 400, error_code: 'InvalidPart', status: 400, code: 'InvalidPart', reason: 'MissingStoredPartETag' };
    }

    if (storedEtag !== manifestEtag) {
      return { http_status: 400, error_code: 'InvalidPart', status: 400, code: 'InvalidPart', reason: 'ETagMismatch' };
    }

    const size = storedPart.size_bytes ?? storedPart.size ?? storedPart.Size ?? part.size_bytes;
    if (typeof size === 'number') {
      if (size > 5368709120) {
        return { http_status: 400, error_code: 'EntityTooLarge', status: 400, code: 'EntityTooLarge', reason: 'PartSizeExceeded' };
      }
      if (i < manifest.parts.length - 1 && size < 5242880) {
        return { http_status: 400, error_code: 'EntityTooSmall', status: 400, code: 'EntityTooSmall', reason: 'NON_FINAL_PART_TOO_SMALL' };
      }
      totalSizeBytes += size;
    }
  }

  if (totalSizeBytes > 5497558138880 || (typeof manifest.total_size_bytes === 'number' && manifest.total_size_bytes > 5497558138880)) {
    return { http_status: 400, error_code: 'EntityTooLarge', status: 400, code: 'EntityTooLarge', reason: 'TotalSizeExceeded' };
  }

  return { http_status: 200, error_code: null, status: 200, code: null };
}

export function dispatchS3Error(conditionOrOptions, maybeHeader) {
  if (
    arguments.length >= 2 ||
    (conditionOrOptions &&
      typeof conditionOrOptions === 'object' &&
      ('payloadBytes' in conditionOrOptions || 'contentMd5Header' in conditionOrOptions || 'x-amz-content-sha256' in conditionOrOptions))
  ) {
    const payloadBytes = arguments.length >= 2 ? conditionOrOptions : conditionOrOptions?.payloadBytes;
    const contentMd5Header = arguments.length >= 2 ? maybeHeader : conditionOrOptions?.contentMd5Header;
    const shaHeader = conditionOrOptions?.['x-amz-content-sha256'] ?? conditionOrOptions?.contentSha256Header;

    if (contentMd5Header !== undefined) {
      if (isMalformedBase64Md5(contentMd5Header)) {
        return {
          http_status: 400,
          error_code: 'InvalidDigest',
          status: 400,
          code: 'InvalidDigest',
          reason: 'MALFORMED_HEADER_SYNTAX',
        };
      }
      const computed = computePayloadMd5(payloadBytes);
      if (computed !== (typeof contentMd5Header === 'string' ? contentMd5Header.trim() : '')) {
        return {
          http_status: 400,
          error_code: 'BadDigest',
          status: 400,
          code: 'BadDigest',
          reason: 'PAYLOAD_DIGEST_MISMATCH',
        };
      }
    }

    if (shaHeader !== undefined) {
      if (shaHeader === 'UNSIGNED-PAYLOAD') {
        // allow
      } else if (isMalformedSha256(shaHeader)) {
        return {
          http_status: 400,
          error_code: 'InvalidDigest',
          status: 400,
          code: 'InvalidDigest',
          reason: 'MALFORMED_HEADER_SYNTAX',
        };
      } else {
        const computedSha = computePayloadSha256(payloadBytes);
        if (computedSha.toLowerCase() !== String(shaHeader).trim().toLowerCase()) {
          return {
            http_status: 400,
            error_code: 'BadDigest',
            status: 400,
            code: 'BadDigest',
            reason: 'PAYLOAD_SHA256_MISMATCH',
          };
        }
      }
    }

    return { http_status: 200, error_code: null, status: 200, code: null };
  }

  if (typeof conditionOrOptions === 'string') {
    const norm = conditionOrOptions.trim();
    if (norm === 'BadDigest' || norm === 'PAYLOAD_DIGEST_MISMATCH' || norm === 'PAYLOAD_SHA256_MISMATCH') {
      return {
        http_status: 400,
        error_code: 'BadDigest',
        status: 400,
        code: 'BadDigest',
        reason: norm === 'PAYLOAD_SHA256_MISMATCH' ? 'PAYLOAD_SHA256_MISMATCH' : 'PAYLOAD_DIGEST_MISMATCH',
      };
    }
    if (
      norm === 'InvalidDigest' ||
      norm === 'MALFORMED_DIGEST_HEADER' ||
      norm === 'MALFORMED_HEADER_SYNTAX' ||
      norm === 'MissingXAmzContentSHA256' ||
      norm === 'STREAMING_PAYLOAD_UNSUPPORTED' ||
      norm === 'MALFORMED_SHA256_HEADER'
    ) {
      return {
        http_status: 400,
        error_code: 'InvalidDigest',
        status: 400,
        code: 'InvalidDigest',
        reason: norm === 'MissingXAmzContentSHA256' || norm === 'STREAMING_PAYLOAD_UNSUPPORTED' || norm === 'MALFORMED_SHA256_HEADER' ? norm : 'MALFORMED_HEADER_SYNTAX',
      };
    }
    if (norm === 'XAmzContentSHA256Mismatch') {
      return {
        http_status: 400,
        error_code: 'InvalidDigest',
        status: 400,
        code: 'InvalidDigest',
        reason: 'XAmzContentSHA256Mismatch',
      };
    }
    if (
      norm === 'InvalidPart' ||
      norm === 'INVALID_PART' ||
      norm === 'PartNotFound' ||
      norm === 'ETagMismatch' ||
      norm === 'PART_NOT_FOUND' ||
      norm === 'ETAG_MISMATCH' ||
      norm === 'MissingStoredPartState' ||
      norm === 'MissingManifestPartETag' ||
      norm === 'MissingStoredPartETag'
    ) {
      return {
        http_status: 400,
        error_code: 'InvalidPart',
        status: 400,
        code: 'InvalidPart',
        reason: (norm === 'ETagMismatch' || norm === 'ETAG_MISMATCH') ? 'ETagMismatch' : (norm === 'MissingStoredPartState' || norm === 'MissingManifestPartETag' || norm === 'MissingStoredPartETag' ? norm : 'PartNotFound'),
      };
    }
    if (
      norm === 'EntityTooSmall' ||
      norm === 'PART_TOO_SMALL' ||
      norm === 'NON_FINAL_PART_TOO_SMALL'
    ) {
      return {
        http_status: 400,
        error_code: 'EntityTooSmall',
        status: 400,
        code: 'EntityTooSmall',
        reason: 'PART_TOO_SMALL',
      };
    }
    if (
      norm === 'EntityTooLarge' ||
      norm === 'PART_TOO_LARGE' ||
      norm === 'PAYLOAD_TOO_LARGE' ||
      norm === 'PartSizeExceeded' ||
      norm === 'PART_SIZE_EXCEEDED' ||
      norm === 'TotalSizeExceeded' ||
      norm === 'TOTAL_SIZE_EXCEEDED'
    ) {
      return {
        http_status: 400,
        error_code: 'EntityTooLarge',
        status: 400,
        code: 'EntityTooLarge',
        reason: norm === 'PartSizeExceeded' || norm === 'PART_SIZE_EXCEEDED' || norm === 'TotalSizeExceeded' || norm === 'TOTAL_SIZE_EXCEEDED' ? norm : 'PART_TOO_LARGE',
      };
    }
    if (
      norm === 'InvalidPartOrder' ||
      norm === 'INVALID_PART_ORDER' ||
      norm === 'DUPLICATE_PART' ||
      norm === 'DUPLICATE_PART_NUMBER' ||
      norm === 'PART_OUT_OF_ORDER' ||
      norm === 'PARTS_NOT_ASCENDING'
    ) {
      return {
        http_status: 400,
        error_code: 'InvalidPartOrder',
        status: 400,
        code: 'InvalidPartOrder',
        reason: norm === 'DUPLICATE_PART' ? 'DUPLICATE_PART' : (norm === 'PART_OUT_OF_ORDER' ? 'PART_OUT_OF_ORDER' : (norm === 'DUPLICATE_PART_NUMBER' ? 'DUPLICATE_PART_NUMBER' : (norm === 'PARTS_NOT_ASCENDING' ? 'PARTS_NOT_ASCENDING' : 'INVALID_PART_ORDER'))),
      };
    }
    if (
      norm === 'InvalidPart' ||
      norm === 'INVALID_PART' ||
      norm === 'MISSING_PART' ||
      norm === 'PART_ETAG_MISMATCH' ||
      norm === 'ETAG_MISMATCH' ||
      norm === 'PART_NOT_FOUND'
    ) {
      return {
        http_status: 400,
        error_code: 'InvalidPart',
        status: 400,
        code: 'InvalidPart',
        reason: norm === 'MISSING_PART' ? 'MISSING_PART' : (norm === 'PART_ETAG_MISMATCH' ? 'PART_ETAG_MISMATCH' : 'INVALID_PART'),
      };
    }
    if (norm === 'NoSuchBucket') {
      return { http_status: 404, error_code: 'NoSuchBucket', status: 404, code: 'NoSuchBucket', reason: 'NO_SUCH_BUCKET' };
    }
    if (norm === 'NoSuchKey') {
      return { http_status: 404, error_code: 'NoSuchKey', status: 404, code: 'NoSuchKey', reason: 'NO_SUCH_KEY' };
    }
    if (norm === 'NoSuchUpload') {
      return { http_status: 404, error_code: 'NoSuchUpload', status: 404, code: 'NoSuchUpload', reason: 'NO_SUCH_UPLOAD' };
    }
    if (norm === 'ObjectLockConfigurationNotFoundError') {
      return { http_status: 404, error_code: 'ObjectLockConfigurationNotFoundError', status: 404, code: 'ObjectLockConfigurationNotFoundError', reason: 'OBJECT_LOCK_CONFIG_NOT_FOUND' };
    }
    if (norm === 'PreconditionFailed') {
      return { http_status: 412, error_code: 'PreconditionFailed', status: 412, code: 'PreconditionFailed', reason: 'PRECONDITION_FAILED' };
    }
    if (norm === 'AccessDenied') {
      return { http_status: 403, error_code: 'AccessDenied', status: 403, code: 'AccessDenied', reason: 'ACCESS_DENIED' };
    }
    if (
      norm === 'InvalidArgument' ||
      norm === 'EmptyPartsList' ||
      norm === 'EMPTY_PARTS_LIST' ||
      norm === 'TooManyParts' ||
      norm === 'InvalidPartNumber' ||
      norm === 'INVALID_PART_NUMBER'
    ) {
      return {
        http_status: 400,
        error_code: 'InvalidArgument',
        status: 400,
        code: 'InvalidArgument',
        reason: norm === 'EmptyPartsList' || norm === 'EMPTY_PARTS_LIST' ? 'EmptyPartsList' : (norm === 'TooManyParts' ? 'TooManyParts' : (norm === 'InvalidPartNumber' || norm === 'INVALID_PART_NUMBER' ? 'InvalidPartNumber' : 'INVALID_ARGUMENT')),
      };
    }
    if (isMalformedBase64Md5(norm)) {
      return {
        http_status: 400,
        error_code: 'InvalidDigest',
        status: 400,
        code: 'InvalidDigest',
        reason: 'MALFORMED_HEADER_SYNTAX',
      };
    }
  }

  if (conditionOrOptions && typeof conditionOrOptions === 'object') {
    const code = conditionOrOptions.error_code || conditionOrOptions.code;
    const reason = conditionOrOptions.error_condition || conditionOrOptions.reason;
    if (code === 'BadDigest' || reason === 'PAYLOAD_DIGEST_MISMATCH' || reason === 'PAYLOAD_SHA256_MISMATCH') {
      return {
        http_status: 400,
        error_code: 'BadDigest',
        status: 400,
        code: 'BadDigest',
        reason: reason || 'PAYLOAD_DIGEST_MISMATCH',
      };
    }
    if (
      code === 'InvalidDigest' ||
      reason === 'MALFORMED_DIGEST_HEADER' ||
      reason === 'MALFORMED_HEADER_SYNTAX' ||
      reason === 'MissingXAmzContentSHA256' ||
      reason === 'STREAMING_PAYLOAD_UNSUPPORTED' ||
      reason === 'MALFORMED_SHA256_HEADER'
    ) {
      return {
        http_status: 400,
        error_code: 'InvalidDigest',
        status: 400,
        code: 'InvalidDigest',
        reason: reason || 'MALFORMED_HEADER_SYNTAX',
      };
    }
    if (reason === 'XAmzContentSHA256Mismatch') {
      return {
        http_status: 400,
        error_code: 'InvalidDigest',
        status: 400,
        code: 'InvalidDigest',
        reason: 'XAmzContentSHA256Mismatch',
      };
    }
    if (
      code === 'InvalidPart' ||
      reason === 'InvalidPart' ||
      reason === 'INVALID_PART' ||
      reason === 'PartNotFound' ||
      reason === 'ETagMismatch' ||
      reason === 'PART_NOT_FOUND' ||
      reason === 'ETAG_MISMATCH' ||
      reason === 'MissingStoredPartState' ||
      reason === 'MissingManifestPartETag' ||
      reason === 'MissingStoredPartETag'
    ) {
      return {
        http_status: 400,
        error_code: 'InvalidPart',
        status: 400,
        code: 'InvalidPart',
        reason: reason || 'PartNotFound',
      };
    }
    if (
      code === 'EntityTooSmall' ||
      reason === 'PART_TOO_SMALL' ||
      reason === 'NON_FINAL_PART_TOO_SMALL'
    ) {
      return {
        http_status: 400,
        error_code: 'EntityTooSmall',
        status: 400,
        code: 'EntityTooSmall',
        reason: reason || 'PART_TOO_SMALL',
      };
    }
    if (
      code === 'EntityTooLarge' ||
      reason === 'PART_TOO_LARGE' ||
      reason === 'PAYLOAD_TOO_LARGE' ||
      reason === 'PartSizeExceeded' ||
      reason === 'PART_SIZE_EXCEEDED' ||
      reason === 'TotalSizeExceeded' ||
      reason === 'TOTAL_SIZE_EXCEEDED'
    ) {
      return {
        http_status: 400,
        error_code: 'EntityTooLarge',
        status: 400,
        code: 'EntityTooLarge',
        reason: reason || 'PART_TOO_LARGE',
      };
    }
    if (
      code === 'InvalidPartOrder' ||
      reason === 'InvalidPartOrder' ||
      reason === 'INVALID_PART_ORDER' ||
      reason === 'DUPLICATE_PART' ||
      reason === 'DUPLICATE_PART_NUMBER' ||
      reason === 'PART_OUT_OF_ORDER' ||
      reason === 'PARTS_NOT_ASCENDING'
    ) {
      return {
        http_status: 400,
        error_code: 'InvalidPartOrder',
        status: 400,
        code: 'InvalidPartOrder',
        reason: reason || 'INVALID_PART_ORDER',
      };
    }
    if (
      code === 'InvalidPart' ||
      reason === 'InvalidPart' ||
      reason === 'INVALID_PART' ||
      reason === 'MISSING_PART' ||
      reason === 'PART_ETAG_MISMATCH' ||
      reason === 'ETAG_MISMATCH' ||
      reason === 'PART_NOT_FOUND'
    ) {
      return {
        http_status: 400,
        error_code: 'InvalidPart',
        status: 400,
        code: 'InvalidPart',
        reason: reason || 'INVALID_PART',
      };
    }
    if (code === 'NoSuchBucket') {
      return { http_status: 404, error_code: 'NoSuchBucket', status: 404, code: 'NoSuchBucket', reason: reason || 'NO_SUCH_BUCKET' };
    }
    if (code === 'NoSuchKey') {
      return { http_status: 404, error_code: 'NoSuchKey', status: 404, code: 'NoSuchKey', reason: reason || 'NO_SUCH_KEY' };
    }
    if (code === 'NoSuchUpload') {
      return { http_status: 404, error_code: 'NoSuchUpload', status: 404, code: 'NoSuchUpload', reason: reason || 'NO_SUCH_UPLOAD' };
    }
    if (code === 'ObjectLockConfigurationNotFoundError') {
      return { http_status: 404, error_code: 'ObjectLockConfigurationNotFoundError', status: 404, code: 'ObjectLockConfigurationNotFoundError', reason: reason || 'OBJECT_LOCK_CONFIG_NOT_FOUND' };
    }
    if (code === 'PreconditionFailed') {
      return { http_status: 412, error_code: 'PreconditionFailed', status: 412, code: 'PreconditionFailed', reason: reason || 'PRECONDITION_FAILED' };
    }
    if (code === 'AccessDenied') {
      return { http_status: 403, error_code: 'AccessDenied', status: 403, code: 'AccessDenied', reason: reason || 'ACCESS_DENIED' };
    }
    if (
      code === 'InvalidArgument' ||
      reason === 'EmptyPartsList' ||
      reason === 'EMPTY_PARTS_LIST' ||
      conditionOrOptions.error_condition === 'EmptyPartsList' ||
      conditionOrOptions.error_condition === 'EMPTY_PARTS_LIST' ||
      reason === 'INVALID_ARGUMENT' ||
      reason === 'INVALID_PART_NUMBER' ||
      reason === 'InvalidPartNumber' ||
      reason === 'TooManyParts'
    ) {
      return {
        http_status: 400,
        error_code: 'InvalidArgument',
        status: 400,
        code: 'InvalidArgument',
        reason: (reason === 'EmptyPartsList' || reason === 'EMPTY_PARTS_LIST' || conditionOrOptions.error_condition === 'EmptyPartsList' || conditionOrOptions.error_condition === 'EMPTY_PARTS_LIST') ? 'EmptyPartsList' : (reason || 'INVALID_ARGUMENT'),
      };
    }
  }

  return {
    http_status: 400,
    error_code: 'BadDigest',
    status: 400,
    code: 'BadDigest',
    reason: 'PAYLOAD_DIGEST_MISMATCH',
  };
}

export function verifyDigestErrorDispatch(payloadOrCondition, maybeHeader, maybeSha) {
  if (
    arguments.length >= 2 ||
    (payloadOrCondition && typeof payloadOrCondition === 'object' && ('payloadBytes' in payloadOrCondition || ('contentMd5Header' in payloadOrCondition && !('http_status' in payloadOrCondition) && !('error_code' in payloadOrCondition))))
  ) {
    const payloadBytes = arguments.length >= 2 ? payloadOrCondition : payloadOrCondition.payloadBytes;
    const contentMd5Header = arguments.length >= 2 ? maybeHeader : payloadOrCondition.contentMd5Header;
    const shaHeader = arguments.length >= 3 ? maybeSha : (payloadOrCondition?.['x-amz-content-sha256'] ?? payloadOrCondition?.contentSha256Header ?? (payloadBytes ? computePayloadSha256(payloadBytes) : undefined));
    const result = dispatchS3PutObject({ payloadBytes, contentMd5Header, 'x-amz-content-sha256': shaHeader });

    if (result.error_code !== 'BadDigest') {
      throw new Error(
        `Strict error dispatch violation: payload byte digest mismatch must exclusively map to BadDigest (HTTP 400), but received error code '${result.error_code}' (InvalidArgument/AccessDenied/other are strictly forbidden)`
      );
    }
    if (result.http_status !== 400) {
      throw new Error(
        `Strict error dispatch violation: payload byte digest mismatch must exclusively map to HTTP 400, but received HTTP status ${result.http_status}`
      );
    }
    return {
      status: 400,
      code: 'BadDigest',
      http_status: 400,
      error_code: 'BadDigest',
      reason: result.reason,
    };
  }

  if (payloadOrCondition && typeof payloadOrCondition === 'object') {
    const code = payloadOrCondition.error_code || payloadOrCondition.code;
    const status = payloadOrCondition.http_status || payloadOrCondition.status;

    if (code !== undefined && code !== 'BadDigest') {
      throw new Error(
        `Strict error dispatch violation: payload byte digest mismatch must exclusively map to BadDigest (HTTP 400), but received error code '${code}' (InvalidArgument/AccessDenied/other are strictly forbidden)`
      );
    }

    if (status !== undefined && status !== 400) {
      throw new Error(
        `Strict error dispatch violation: payload byte digest mismatch must exclusively map to HTTP 400, but received HTTP status ${status}`
      );
    }
  }

  return {
    status: 400,
    code: 'BadDigest',
    http_status: 400,
    error_code: 'BadDigest',
    reason: (payloadOrCondition && typeof payloadOrCondition === 'object' && payloadOrCondition.reason) || 'PAYLOAD_DIGEST_MISMATCH',
  };
}

export function verifyMalformedHeaderDispatch(headerOrCondition, maybeHeader, maybeSha) {
  if (
    arguments.length >= 2 ||
    (headerOrCondition && typeof headerOrCondition === 'object' && ('payloadBytes' in headerOrCondition || ('contentMd5Header' in headerOrCondition && !('http_status' in headerOrCondition) && !('error_code' in headerOrCondition))))
  ) {
    const payloadBytes = arguments.length >= 2 ? headerOrCondition : (headerOrCondition.payloadBytes ?? Buffer.from('TEST_PAYLOAD'));
    const contentMd5Header = arguments.length >= 2 ? maybeHeader : (headerOrCondition.content_md5_header ?? headerOrCondition.contentMd5Header ?? headerOrCondition.header);
    const shaHeader = arguments.length >= 3 ? maybeSha : (headerOrCondition?.['x-amz-content-sha256'] ?? headerOrCondition?.contentSha256Header ?? (payloadBytes ? computePayloadSha256(payloadBytes) : 'UNSIGNED-PAYLOAD'));
    const result = dispatchS3PutObject({ payloadBytes, contentMd5Header, 'x-amz-content-sha256': shaHeader });

    if (result.error_code !== 'InvalidDigest') {
      throw new Error(
        `Strict error dispatch violation: malformed digest header must exclusively map to InvalidDigest (HTTP 400), but received error code '${result.error_code}' (InvalidArgument/AccessDenied/other are strictly forbidden)`
      );
    }
    if (result.http_status !== 400) {
      throw new Error(
        `Strict error dispatch violation: malformed digest header must exclusively map to HTTP 400, but received HTTP status ${result.http_status}`
      );
    }
    return {
      status: 400,
      code: 'InvalidDigest',
      http_status: 400,
      error_code: 'InvalidDigest',
      reason: result.reason,
    };
  }

  if (headerOrCondition && typeof headerOrCondition === 'object') {
    const code = headerOrCondition.error_code || headerOrCondition.code;
    const status = headerOrCondition.http_status || headerOrCondition.status;

    if (code !== undefined && code !== 'InvalidDigest') {
      throw new Error(
        `Strict error dispatch violation: malformed digest header must exclusively map to InvalidDigest (HTTP 400), but received error code '${code}' (InvalidArgument/AccessDenied/other are strictly forbidden)`
      );
    }

    if (status !== undefined && status !== 400) {
      throw new Error(
        `Strict error dispatch violation: malformed digest header must exclusively map to HTTP 400, but received HTTP status ${status}`
      );
    }
  } else if (typeof headerOrCondition === 'string') {
    if (!isMalformedBase64Md5(headerOrCondition)) {
      throw new Error(
        `Header string '${headerOrCondition}' is a valid base64 MD5 digest, not a malformed header error condition`
      );
    }
  }

  return {
    status: 400,
    code: 'InvalidDigest',
    http_status: 400,
    error_code: 'InvalidDigest',
    reason: (headerOrCondition && typeof headerOrCondition === 'object' && headerOrCondition.reason) || 'MALFORMED_HEADER_SYNTAX',
  };
}

export function validateS3MultipartSemantics(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Semantic error: multipart manifest must be an object');
  }

  const parts = manifest.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new Error('Semantic error: multipart upload manifest parts array must be non-empty');
  }

  if (parts.length > 10000) {
    throw new Error(
      `Semantic error: multipart upload manifest total parts (${parts.length}) exceeds maximum limit of 10000 (InvalidArgument)`
    );
  }

  if (typeof manifest.total_parts === 'number' && manifest.total_parts !== parts.length) {
    throw new Error(
      `Semantic error: multipart upload manifest total_parts (${manifest.total_parts}) does not match parts array length (${parts.length})`
    );
  }

  let totalSize = 0;
  const seenParts = new Set();
  let prevPartNumber = 0;

  const MIN_NON_FINAL_PART_SIZE = 5 * 1024 * 1024; // 5 MiB = 5,242,880 bytes
  const MAX_PART_SIZE = 5 * 1024 * 1024 * 1024; // 5 GiB = 5,368,709,120 bytes

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (typeof part.part_number === 'number') {
      if (part.part_number < 1 || part.part_number > 10000 || !Number.isInteger(part.part_number)) {
        throw new Error(
          `Semantic error: multipart upload manifest part number ${part.part_number} is out of bounds [1, 10000] (InvalidArgument)`
        );
      }
      if (seenParts.has(part.part_number) || part.part_number <= prevPartNumber) {
        throw new Error(
          `Semantic error: multipart upload manifest parts must be in strictly ascending order by part_number with no duplicates (found part ${part.part_number} after ${prevPartNumber || part.part_number}) (InvalidPartOrder)`
        );
      }
      seenParts.add(part.part_number);
      prevPartNumber = part.part_number;
    }

    if (typeof part.size_bytes === 'number') {
      if (part.size_bytes < 0) {
        throw new Error(
          `Semantic error: multipart upload manifest part ${part.part_number} size (${part.size_bytes} bytes) cannot be negative`
        );
      }
      if (part.size_bytes > 5368709120) {
        throw new Error(
          `Semantic error: multipart upload manifest part ${part.part_number} size (${part.size_bytes} bytes) exceeds maximum part size of 5368709120 bytes (5 GiB) (EntityTooLarge)`
        );
      }
      if (i < parts.length - 1 && part.size_bytes < 5242880) {
        throw new Error(
          `Semantic error: multipart upload manifest part ${part.part_number} size (${part.size_bytes} bytes) is below minimum non-final part size of 5242880 bytes (5 MiB) (EntityTooSmall)`
        );
      }
      totalSize += part.size_bytes;
    }
  }

  if (typeof manifest.total_size_bytes === 'number' && manifest.total_size_bytes !== totalSize) {
    throw new Error(
      `Semantic error: multipart upload manifest total_size_bytes (${manifest.total_size_bytes}) does not match sum of part sizes (${totalSize})`
    );
  }

  if (totalSize > 5497558138880 || (typeof manifest.total_size_bytes === 'number' && manifest.total_size_bytes > 5497558138880)) {
    throw new Error(
      `Semantic error: multipart upload manifest total_size_bytes (${manifest.total_size_bytes || totalSize} bytes) exceeds maximum total size of 5497558138880 bytes (5 TiB) (EntityTooLarge)`
    );
  }

  return true;
}

const S3_17_MANDATORY_OPS = [
  'PutObject',
  'GetObject',
  'HeadObject',
  'DeleteObject',
  'DeleteObjects',
  'ListObjectsV2',
  'HeadBucket',
  'CreateBucket',
  'PutObjectRetention',
  'GetObjectRetention',
  'PutObjectLegalHold',
  'GetObjectLegalHold',
  'CreateMultipartUpload',
  'UploadPart',
  'CompleteMultipartUpload',
  'AbortMultipartUpload',
  'ListParts'
];

export const S3_CANONICAL_ERROR_CODES = [
  'BadDigest',
  'InvalidDigest',
  'NoSuchBucket',
  'NoSuchKey',
  'NoSuchUpload',
  'ObjectLockConfigurationNotFoundError',
  'PreconditionFailed',
  'AccessDenied',
  'EntityTooLarge',
  'EntityTooSmall',
  'InvalidArgument',
  'InvalidPart',
  'InvalidPartOrder'
];

export const ALL_13_CONFORMANCE_SLOTS = [
  'oci_container_runtime',
  'isolation_substrate',
  'orchestration_capability',
  'network_segmentation',
  'storage',
  'database',
  'cache',
  'secrets',
  'crypto',
  'identity_workload_identity',
  'observability',
  'ai_model_runtime',
  'artifact_update_mechanism'
];

const CORE_MANDATORY_SLOTS = [
  'oci_container_runtime',
  'isolation_substrate',
  'network_segmentation',
  'storage',
  'database',
  'secrets',
  'crypto',
  'identity_workload_identity',
  'artifact_update_mechanism'
];

export function validatePlatformSemantics(data, schemaId) {
  if (schemaId.includes('provider-capability-advertisement') || schemaId.includes('provider-capability-negotiation')) {
    const adv = data.advertisement_response || data;
    const isNegotiation = schemaId.includes('provider-capability-negotiation') || !!data.agreed_capability_lease;
    const referencedSet = new Set();

    if (adv.advertised_capabilities || adv.conformance_evidence) {
      const validTests = new Map();
      for (const e of (adv.conformance_evidence || [])) {
        if (validTests.has(e.test_identifier)) {
          throw new Error(`Semantic error: duplicate test_identifier '${e.test_identifier}'`);
        }
        if (e.status !== 'PASS') {
          throw new Error(`Semantic error: conformance evidence '${e.test_identifier}' has non-passing status '${e.status}'`);
        }
        if (typeof e.evidence_pack_digest !== 'string' || !/^[a-f0-9]{64}$/.test(e.evidence_pack_digest)) {
          throw new Error(`Semantic error: conformance evidence '${e.test_identifier}' lacks valid SHA-256 evidence_pack_digest`);
        }
        validTests.set(e.test_identifier, e);
      }

      const seenSlotIds = new Set();

      for (const cap of (adv.advertised_capabilities || [])) {
        if (cap.slot_id) {
          if (seenSlotIds.has(cap.slot_id)) {
            throw new Error(`Semantic error: advertised_capabilities contains duplicate slot_id '${cap.slot_id}'`);
          }
          seenSlotIds.add(cap.slot_id);
        }
        for (const ref of (cap.evidence_references || [])) {
          const matchingEv = validTests.get(ref);
          if (!matchingEv) {
            throw new Error(`Semantic error: evidence_reference '${ref}' not found in conformance_evidence`);
          }
          referencedSet.add(ref);
        }
      }

      const leaseCaps = data.agreed_capability_lease?.negotiated_optional_capabilities || data.agreed_capability_lease?.agreed_capabilities || [];
      for (const cap of leaseCaps) {
        for (const ref of (cap.evidence_references || [])) {
          const matchingEv = validTests.get(ref);
          if (!matchingEv) {
            throw new Error(`Semantic error: evidence_reference '${ref}' not found in conformance_evidence`);
          }
          referencedSet.add(ref);
        }
      }
    }
    const claimType = adv.claim_type || data.claim_type;
    const targetProfileId = data.target_profile_id || adv.target_profile_id;
    const targetProfileDigest = data.target_profile_digest;
    const advProfileDigest = adv.target_profile_digest;

    if (claimType === 'FULL_PROFILE_CONFORMANCE_DECLARATION') {
      const advCaps = adv.advertised_capabilities || [];
      const seenSlots = new Set();
      for (const cap of advCaps) {
        if (!cap || typeof cap.slot_id !== 'string' || !cap.slot_id) {
          throw new Error(`Semantic error: FULL_PROFILE_CONFORMANCE_DECLARATION capability descriptor missing slot_id`);
        }
        seenSlots.add(cap.slot_id);
      }
      for (const slot of ALL_13_CONFORMANCE_SLOTS) {
        if (!seenSlots.has(slot)) {
          throw new Error(`Semantic error: FULL_PROFILE_CONFORMANCE_DECLARATION missing required mandatory profile slot '${slot}' from 13-slot baseline`);
        }
      }
      if (!Array.isArray(advCaps) || advCaps.length !== 13) {
        throw new Error(`Semantic error: FULL_PROFILE_CONFORMANCE_DECLARATION must declare exactly 13 advertised capabilities (got ${Array.isArray(advCaps) ? advCaps.length : 0})`);
      }
    }

    if (isNegotiation) {
      if (!data.target_profile_digest || typeof data.target_profile_digest !== 'string' || !/^[a-f0-9]{64}$/.test(data.target_profile_digest)) {
        throw new Error(`Semantic error: target_profile_digest is required and must match ^[a-f0-9]{64}$ on negotiation handshake`);
      }
      if (data.advertisement_response && (!data.advertisement_response.target_profile_digest || typeof data.advertisement_response.target_profile_digest !== 'string' || !/^[a-f0-9]{64}$/.test(data.advertisement_response.target_profile_digest))) {
        throw new Error(`Semantic error: advertisement_response.target_profile_digest must match ^[a-f0-9]{64}$`);
      }
    } else if (claimType === 'FULL_PROFILE_CONFORMANCE_DECLARATION' || data.advertisement_response) {
      const effDigest = targetProfileDigest || advProfileDigest;
      if (!effDigest || typeof effDigest !== 'string' || !/^[a-f0-9]{64}$/.test(effDigest)) {
        throw new Error(`Semantic error: target_profile_digest is required and must match ^[a-f0-9]{64}$ on advertisement_response`);
      }
      if (adv.target_profile_digest && (typeof adv.target_profile_digest !== 'string' || !/^[a-f0-9]{64}$/.test(adv.target_profile_digest))) {
        throw new Error(`Semantic error: advertisement_response.target_profile_digest must match ^[a-f0-9]{64}$`);
      }
    } else if (targetProfileDigest !== undefined && targetProfileDigest !== null) {
      if (typeof targetProfileDigest !== 'string' || !/^[a-f0-9]{64}$/.test(targetProfileDigest)) {
        throw new Error(`Semantic error: target_profile_digest must match ^[a-f0-9]{64}$`);
      }
    }

    if (data.agreed_capability_lease) {
      const lease = data.agreed_capability_lease;
      if (lease.issued_at && lease.valid_until) {
        const issued_at_ms = Date.parse(lease.issued_at);
        const valid_until_ms = Date.parse(lease.valid_until);
        if (Number.isNaN(issued_at_ms) || Number.isNaN(valid_until_ms)) {
          throw new Error(`Semantic error: invalid timestamp format in lease`);
        }
        if (!(valid_until_ms > issued_at_ms)) {
          throw new Error(`Semantic error: lease valid_until_ms (${valid_until_ms}) must be strictly greater than issued_at_ms (${issued_at_ms})`);
        }
        if (typeof lease.ttl_seconds === 'number') {
          const duration_ms = valid_until_ms - issued_at_ms;
          const expected_ms = lease.ttl_seconds * 1000;
          if (duration_ms !== expected_ms) {
            throw new Error(`Semantic error: lease ttl_seconds (${lease.ttl_seconds}) does not match timestamp duration (${expected_ms}ms expected vs ${duration_ms}ms actual)`);
          }
        }
      }

      const caps = lease.negotiated_optional_capabilities || lease.agreed_capabilities || [];

      if (targetProfileId) {
        const profilePath = join(CONTRACTS, 'examples/platform', `${targetProfileId}.profile.json`);
        if (existsSync(profilePath)) {
          const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
          const immutableStorageMandated =
            profile.slots?.storage?.specification?.immutable_storage_required === true;

          if (immutableStorageMandated) {
            for (const cap of caps) {
              const isStorageCap = cap.slot_id === 'storage' || cap.capability_name === 'storage_object_lock';
              const isDegraded =
                cap.disposition === 'GRANTED_DEGRADED' ||
                cap.status === 'GRANTED_DEGRADED' ||
                cap.disposition === 'REJECTED_UNSUPPORTED' ||
                cap.status === 'REJECTED_UNSUPPORTED' ||
                (cap.fallback_applied !== undefined && cap.fallback_applied !== 'NONE') ||
                (cap.effective_fallback !== undefined && cap.effective_fallback !== 'NONE');
              if (isStorageCap && isDegraded) {
                throw new Error(`Semantic error: DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN: immutable storage capability '${cap.capability_name || cap.slot_id}' cannot be degraded in lease`);
              }
            }
          }
        }
      }

      // F-02: Biconditional coupling between disposition and fallback_applied
      for (const cap of caps) {
        const capStatus = cap.disposition || cap.status;
        const fallback = cap.fallback_applied || cap.effective_fallback || cap.fallback || 'NONE';
        if (capStatus === 'GRANTED_FULL' && fallback !== 'NONE') {
          throw new Error(`Semantic error: capability '${cap.capability_name || cap.slot_id}' with disposition 'GRANTED_FULL' cannot have fallback '${fallback}' (must be 'NONE')`);
        }
        if (fallback === 'NONE' && capStatus !== 'GRANTED_FULL') {
          throw new Error(`Semantic error: capability '${cap.capability_name || cap.slot_id}' with fallback 'NONE' must have disposition 'GRANTED_FULL' (got '${capStatus}')`);
        }
      }

      if (lease.lease_status === 'ACTIVE_OPTIMAL') {
        for (const cap of caps) {
          const capStatus = cap.disposition || cap.status;
          const fallback = cap.fallback_applied || cap.effective_fallback || cap.fallback || 'NONE';
          if (capStatus === 'GRANTED_DEGRADED' || capStatus === 'REJECTED_UNSUPPORTED' || capStatus !== 'GRANTED_FULL' || fallback !== 'NONE') {
            throw new Error(`Semantic error: ACTIVE_OPTIMAL lease cannot contain degraded capability '${cap.capability_name}' (status: ${capStatus}, fallback: ${fallback})`);
          }
        }
      } else if (lease.lease_status === 'ACTIVE_DEGRADED') {
        const hasDegraded = caps.some(cap => {
          const capStatus = cap.disposition || cap.status;
          const fallback = cap.fallback_applied || cap.effective_fallback || cap.fallback || 'NONE';
          return capStatus === 'GRANTED_DEGRADED' && fallback !== 'NONE';
        });
        if (!hasDegraded) {
          throw new Error(`Semantic error: ACTIVE_DEGRADED lease must contain at least one GRANTED_DEGRADED capability with non-NONE fallback`);
        }
      }
    }

    // R16-02: Composite Key Uniqueness on Request and Lease Arrays
    if (data.negotiation_request && Array.isArray(data.negotiation_request.requested_optional_capabilities)) {
      const seenReqKeys = new Set();
      for (const cap of data.negotiation_request.requested_optional_capabilities) {
        const key = `${cap.capability_name}::${cap.slot_id}`;
        if (seenReqKeys.has(key)) {
          throw new Error(`Semantic error: requested_optional_capabilities contains duplicate composite key (${cap.capability_name}, ${cap.slot_id})`);
        }
        seenReqKeys.add(key);
      }
    }

    if (data.agreed_capability_lease) {
      const leaseCaps = data.agreed_capability_lease.negotiated_optional_capabilities || data.agreed_capability_lease.agreed_capabilities;
      if (Array.isArray(leaseCaps)) {
        const seenLeaseKeys = new Set();
        for (const cap of leaseCaps) {
          const key = `${cap.capability_name}::${cap.slot_id}`;
          if (seenLeaseKeys.has(key)) {
            throw new Error(`Semantic error: negotiated_optional_capabilities contains duplicate composite key (${cap.capability_name}, ${cap.slot_id})`);
          }
          seenLeaseKeys.add(key);
        }
      }
    }

    // F-03: Requested-to-lease composite key and cardinality closure (strict bidirectional multiset equality)
    if (data.negotiation_request && data.agreed_capability_lease) {
      const reqCaps = data.negotiation_request.requested_optional_capabilities || [];
      const leaseCaps = data.agreed_capability_lease.negotiated_optional_capabilities || data.agreed_capability_lease.agreed_capabilities || [];

      // Multiset counts keyed by composite identity (capability_name, slot_id)
      const reqCountMap = new Map();
      for (const req of reqCaps) {
        const key = `${req.capability_name}::${req.slot_id}`;
        reqCountMap.set(key, (reqCountMap.get(key) || 0) + 1);
      }

      const leaseCountMap = new Map();
      for (const cap of leaseCaps) {
        const key = `${cap.capability_name}::${cap.slot_id}`;
        leaseCountMap.set(key, (leaseCountMap.get(key) || 0) + 1);
      }

      // Assert requested capabilities are satisfied with equal cardinality
      for (const req of reqCaps) {
        const key = `${req.capability_name}::${req.slot_id}`;
        const reqCount = reqCountMap.get(key) || 0;
        const leaseCount = leaseCountMap.get(key) || 0;
        if (leaseCount < reqCount) {
          if (req.slot_id) {
            throw new Error(`Semantic error: requested optional capability '${req.capability_name}' for slot '${req.slot_id}' is not resolved in agreed_capability_lease`);
          } else {
            throw new Error(`Semantic error: requested optional capability '${req.capability_name}' is not resolved in agreed_capability_lease`);
          }
        }
      }

      // Assert lease contains no surplus or unrequested capabilities
      for (const cap of leaseCaps) {
        const key = `${cap.capability_name}::${cap.slot_id}`;
        const reqCount = reqCountMap.get(key) || 0;
        const leaseCount = leaseCountMap.get(key) || 0;
        if (leaseCount > reqCount) {
          if (cap.slot_id) {
            throw new Error(`Semantic error: agreed_capability_lease contains unrequested or surplus optional capability '${cap.capability_name}' for slot '${cap.slot_id}'`);
          } else {
            throw new Error(`Semantic error: agreed_capability_lease contains unrequested or surplus optional capability '${cap.capability_name}'`);
          }
        }
      }
    }

    if (data.negotiation_request && Array.isArray(data.negotiation_request.requested_slots)) {
      const requestedSlots = new Set(data.negotiation_request.requested_slots);
      for (const slot of CORE_MANDATORY_SLOTS) {
        if (!requestedSlots.has(slot)) {
          throw new Error(`Semantic error: negotiation_request.requested_slots missing core mandatory slot '${slot}'`);
        }
      }
    }

    if ((isNegotiation || claimType === 'FULL_PROFILE_CONFORMANCE_DECLARATION') && adv.advertised_capabilities) {
      const storageCap = adv.advertised_capabilities.find(c => c.slot_id === 'storage');
      if (storageCap) {
        if (storageCap.supported_features) {
          const featureSet = new Set(storageCap.supported_features);
          for (const op of S3_17_MANDATORY_OPS) {
            if (!featureSet.has(op)) {
              throw new Error(`Semantic error: storage slot advertisement missing required S3 operation '${op}' from 17-operation baseline`);
            }
          }
        }
        const storageRefs = new Set(storageCap.evidence_references || []);
        const validTests = new Set((adv.conformance_evidence || []).map(e => e.test_identifier));

        // Validate Object Lock evidence bindings against structured URN evidence IDs declared in advertisement.evidence_bindings
        const evidenceBindings = adv.evidence_bindings || data.evidence_bindings;
        let boundObjectLockEvidenceId = null;
        if (evidenceBindings) {
          if (typeof evidenceBindings === 'object') {
            if (Array.isArray(evidenceBindings)) {
              for (const binding of evidenceBindings) {
                const isLockBinding =
                  binding.capability_name === 'storage_object_lock' ||
                  binding.slot_id === 'storage' ||
                  binding.feature === 'object_lock' ||
                  binding.name === 'storage_object_lock' ||
                  binding.name === 'object_lock';
                if (isLockBinding) {
                  const evId = binding.evidence_id || binding.test_identifier || binding.urn;
                  if (evId) {
                    boundObjectLockEvidenceId = evId;
                    if (!storageRefs.has(evId)) {
                      throw new Error(`Semantic error: Object Lock evidence binding '${evId}' not found in storage evidence references`);
                    }
                    if (!validTests.has(evId)) {
                      throw new Error(`Semantic error: Object Lock evidence binding '${evId}' not found in conformance evidence`);
                    }
                    if (typeof evId === 'string' && evId.startsWith('urn:') && !/^urn:[a-z0-9][a-z0-9-]{0,31}:[a-z0-9()+,\-.:=@;$_!*'%/?#]+$/i.test(evId)) {
                      throw new Error(`Semantic error: Object Lock evidence binding URN '${evId}' is malformed`);
                    }
                  }
                }
              }
            } else {
              for (const [key, val] of Object.entries(evidenceBindings)) {
                const isLockKey =
                  key === 'storage_object_lock' ||
                  key === 'storage' ||
                  key === 'object_lock';
                if (isLockKey) {
                  const evId = typeof val === 'string' ? val : (val?.evidence_id || val?.test_identifier || val?.urn);
                  if (evId) {
                    boundObjectLockEvidenceId = evId;
                    if (!storageRefs.has(evId)) {
                      throw new Error(`Semantic error: Object Lock evidence binding '${evId}' for '${key}' not found in storage evidence references`);
                    }
                    if (!validTests.has(evId)) {
                      throw new Error(`Semantic error: Object Lock evidence binding '${evId}' for '${key}' not found in conformance evidence`);
                    }
                    if (typeof evId === 'string' && evId.startsWith('urn:') && !/^urn:[a-z0-9][a-z0-9-]{0,31}:[a-z0-9()+,\-.:=@;$_!*'%/?#]+$/i.test(evId)) {
                      throw new Error(`Semantic error: Object Lock evidence binding URN '${evId}' is malformed`);
                    }
                  }
                }
              }
            }
          }
        }

        const OBJECT_LOCK_URN_PATTERN = /^urn:cybrik:evidence:(?:storage:(?:s3:conformance:v\d+:)?object-lock|storage-object-lock|object-lock)(?::[a-zA-Z0-9_-]+)*$/;

        const lockRefs = (storageCap.evidence_references || []).filter(ref => OBJECT_LOCK_URN_PATTERN.test(ref));
        if (lockRefs.length === 0) {
          throw new Error(`Semantic error: storage slot advertisement lacks Object Lock retention evidence`);
        }
      }
    }

    if (claimType === 'FULL_PROFILE_CONFORMANCE_DECLARATION' && !targetProfileDigest) {
      throw new Error(`Semantic error: FULL_PROFILE_CONFORMANCE_DECLARATION requires target_profile_digest`);
    }

    if (targetProfileId && targetProfileDigest) {
      const profilePath = join(CONTRACTS, 'examples/platform', `${targetProfileId}.profile.json`);
      if (!existsSync(profilePath)) {
        throw new Error(`Semantic error: target profile fixture '${targetProfileId}.profile.json' not found`);
      }
      const actualDigest = createHash('sha256').update(readFileSync(profilePath)).digest('hex');
      if (actualDigest !== targetProfileDigest) {
        throw new Error(`Semantic error: target_profile_digest '${targetProfileDigest}' does not match disk profile digest for '${targetProfileId}' and does not match actual digest '${actualDigest}'`);
      }
      if (data.advertisement_response?.target_profile_digest && data.advertisement_response.target_profile_digest !== actualDigest) {
        throw new Error(`Semantic error: advertisement_response.target_profile_digest '${data.advertisement_response.target_profile_digest}' does not match disk profile digest for '${targetProfileId}' and does not match actual digest '${actualDigest}'`);
      }
      if (data.agreed_capability_lease) {
        const lease = data.agreed_capability_lease;
        if (lease.target_profile_digest && lease.target_profile_digest !== actualDigest) {
          throw new Error(`Semantic error: lease target_profile_digest '${lease.target_profile_digest}' does not match disk profile digest for '${targetProfileId}' and does not match actual digest '${actualDigest}'`);
        }
        if (lease.target_profile_id && lease.target_profile_id !== targetProfileId) {
          throw new Error(`Semantic error: lease target_profile_id '${lease.target_profile_id}' does not match document target_profile_id '${targetProfileId}'`);
        }
      }
    }

    if (targetProfileId) {
      const profilePath = join(CONTRACTS, 'examples/platform', `${targetProfileId}.profile.json`);
      if (existsSync(profilePath)) {
        const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
        const mandatorySlots = new Set(CORE_MANDATORY_SLOTS);
        if (profile.strength) {
          for (const [slot, str] of Object.entries(profile.strength)) {
            if (str === 'MANDATORY') mandatorySlots.add(slot);
          }
        }
        if (profile.slots) {
          for (const [slot, spec] of Object.entries(profile.slots)) {
            if (spec.specification?.required === true) {
              mandatorySlots.add(slot);
            }
          }
        }

        if (adv.advertised_capabilities) {
          for (const cap of adv.advertised_capabilities) {
            if (mandatorySlots.has(cap.slot_id)) {
              if (cap.is_mandatory !== true) {
                throw new Error(`Semantic error: mandatory profile slot '${cap.slot_id}' capability must have is_mandatory === true (got ${cap.is_mandatory}); profile mandatory slot '${cap.slot_id}' cannot be marked is_mandatory: false`);
              }
            }
          }
        }

        if (claimType === 'FULL_PROFILE_CONFORMANCE_DECLARATION') {
          const advSlots = new Set((adv.advertised_capabilities || []).map(c => c.slot_id));
          for (const slot of mandatorySlots) {
            if (!advSlots.has(slot)) {
              throw new Error(`Semantic error: FULL_PROFILE_CONFORMANCE_DECLARATION mandatory profile slot '${slot}' not found in advertised capabilities`);
            }
          }
          for (const cap of (adv.advertised_capabilities || [])) {
            if (cap.disposition === 'REJECTED_FAIL_CLOSED' || cap.status === 'REJECTED_FAIL_CLOSED') {
              throw new Error(`Semantic error: FULL_PROFILE_CONFORMANCE_DECLARATION cannot contain capability '${cap.capability_name || cap.slot_id}' with disposition 'REJECTED_FAIL_CLOSED'`);
            }
          }
        }

        if (isNegotiation && (data.negotiation_status === 'AGREED_LEASE_GRANTED' || data.negotiation_status === 'DEGRADED_LEASE_GRANTED' || (data.agreed_capability_lease && data.agreed_capability_lease.lease_status !== 'REJECTED_FAIL_CLOSED'))) {
          const lease = data.agreed_capability_lease || {};
          const satisfiedSlots = new Set(lease.mandatory_slots_satisfied || []);
          const advertisedMap = new Map();
          for (const cap of (adv.advertised_capabilities || [])) {
            advertisedMap.set(cap.slot_id, cap);
          }
          const evidenceMap = new Map((adv.conformance_evidence || []).map(e => [e.test_identifier, e]));

          for (const slot of mandatorySlots) {
            if (!satisfiedSlots.has(slot)) {
              throw new Error(`Semantic error: mandatory profile slot '${slot}' not present in lease mandatory_slots_satisfied`);
            }
            const advertised = advertisedMap.get(slot);
            if (!advertised) {
              throw new Error(`Semantic error: mandatory profile slot '${slot}' not found in advertised capabilities`);
            }
            const refs = advertised.evidence_references || [];
            if (refs.length === 0) {
              throw new Error(`Semantic error: mandatory profile slot '${slot}' lacks evidence references`);
            }
            for (const ref of refs) {
              const ev = evidenceMap.get(ref);
              if (!ev) {
                throw new Error(`Semantic error: mandatory profile slot '${slot}' evidence reference '${ref}' not found in conformance evidence`);
              }
              if (ev.status && ev.status !== 'PASS') {
                throw new Error(`Semantic error: mandatory profile slot '${slot}' conformance evidence '${ref}' has non-passing status '${ev.status}'`);
              }
            }
          }

          const immutableStorageMandated =
            profile.slots?.storage?.specification?.immutable_storage_required === true;

          if (immutableStorageMandated) {
            const leaseCaps = lease.negotiated_optional_capabilities || lease.agreed_capabilities || [];
            for (const cap of leaseCaps) {
              const isStorageCap = cap.slot_id === 'storage' || cap.capability_name === 'storage_object_lock';
              if (isStorageCap) {
                const disposition = cap.disposition || cap.status;
                const fallback = cap.fallback_applied || cap.effective_fallback || 'NONE';
                if (disposition !== 'GRANTED_FULL' || fallback !== 'NONE') {
                  throw new Error(`Semantic error: DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN: immutable storage capability '${cap.capability_name || cap.slot_id}' cannot be degraded in lease (disposition: ${disposition}, fallback: ${fallback})`);
                }
              }
            }
          }
        }
      }
    }

    for (const e of (adv.conformance_evidence || [])) {
      if (!referencedSet.has(e.test_identifier)) {
        throw new Error(`Semantic error: conformance_evidence contains unreferenced or dangling evidence '${e.test_identifier}'`);
      }
    }
  } else if (schemaId.includes('offline-install-update-manifest')) {
    if (data.artifacts) {
      const paths = new Set();
      for (const art of data.artifacts) {
        const norm = posix.normalize(art.path);
        if (paths.has(norm)) {
          throw new Error(`Semantic error: duplicate artifact path '${norm}'`);
        }
        paths.add(norm);
      }
    }
    if (data.update_station_workflow) {
      const allSteps = [
        ...(data.update_station_workflow.preflight_steps || []),
        ...(data.update_station_workflow.apply_steps || []),
        ...(data.update_station_workflow.rollback_steps || []),
      ];
      for (const step of allSteps) {
        if (step && step.action === 'RESTORE_DATABASE_SNAPSHOT') {
          const target = step.target;
          if (typeof target !== 'string') {
            throw new Error(`Semantic error: RESTORE_DATABASE_SNAPSHOT step target must be a string`);
          }
          if (target.includes('//')) {
            throw new Error(`Semantic error: invalid RESTORE_DATABASE_SNAPSHOT target path '${target}': contains double slash '//'`);
          }
          const segments = target.split('/');
          for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            if (seg === '') {
              throw new Error(`Semantic error: invalid RESTORE_DATABASE_SNAPSHOT target path '${target}': contains empty path segment`);
            }
            if (seg.startsWith('.') && seg !== '$PRE_APPLY_SNAPSHOT') {
              throw new Error(`Semantic error: invalid RESTORE_DATABASE_SNAPSHOT target path '${target}': contains leading dot segment '${seg}'`);
            }
          }
          if (!target.startsWith('snapshots/') && !target.startsWith('$PRE_APPLY_SNAPSHOT/')) {
            throw new Error(`Semantic error: invalid RESTORE_DATABASE_SNAPSHOT target path '${target}': must start with 'snapshots/' or '$PRE_APPLY_SNAPSHOT/'`);
          }
          if (target.includes('..')) {
            throw new Error(`Semantic error: invalid RESTORE_DATABASE_SNAPSHOT target path '${target}': contains '..' traversal sequence`);
          }
          if (target.endsWith('/')) {
            throw new Error(`Semantic error: invalid RESTORE_DATABASE_SNAPSHOT target path '${target}': ends with trailing slash`);
          }
          if (!/\.(?:sql|db|bak)$/.test(target)) {
            throw new Error(`Semantic error: invalid RESTORE_DATABASE_SNAPSHOT target path '${target}': must have extension .sql, .db, or .bak`);
          }
        }
      }
    }
  } else if (schemaId.includes('storage-s3-compatibility-subset') || schemaId.includes('multipartUploadManifest') || schemaId.includes('storageConformanceProfile') || (data && Array.isArray(data.required_error_codes))) {
    if (data && Array.isArray(data.parts)) {
      validateS3MultipartSemantics(data);
    }
    // R16-01: All 13 Canonical S3 Error Codes Required in Storage Conformance Profile
    if (data && (Array.isArray(data.required_error_codes) || data.provider_identifier || data.required_operations)) {
      const errSet = new Set(data.required_error_codes || []);
      for (const code of S3_CANONICAL_ERROR_CODES) {
        if (!errSet.has(code)) {
          throw new Error(`Semantic error: storage conformance profile required_error_codes is missing required canonical error code '${code}'`);
        }
      }
    }
  }
}


// ---------------------------------------------------------------------------
// 0. Lifecycle state. Exactly TWO truthful states are permitted, and the
//    compatibility manifest is the single source of truth. Neither state is a
//    stable v1/GA and neither may be an immutable bundle tag (mutable snapshot
//    v0.1.1, is-bundle-tag=false). Every packet member MUST agree with the
//    manifest: a half-flipped packet (some files ACCEPTED, some PROPOSED) is a
//    consistency failure — which is exactly what checkLifecycle exists to catch.
// ---------------------------------------------------------------------------
const LIFECYCLE = {
  'PROPOSED': { status: 'PROPOSED', notAccepted: true },
  'ACCEPTED FOR IMPLEMENTATION': { status: 'ACCEPTED FOR IMPLEMENTATION', notAccepted: false },
};
const COMPAT_PATH = join(CONTRACTS, 'compatibility', 'cybrik-suite-contract-packet.v1.manifest.json');
let EXPECTED_STATE = null;
try {
  const s = readJson(COMPAT_PATH)['x-cybrik-status'];
  if (LIFECYCLE[s]) EXPECTED_STATE = s;
  else fail(`compatibility manifest: x-cybrik-status must be one of ${Object.keys(LIFECYCLE).map((k) => `'${k}'`).join(' | ')} (got '${s}'); no stable/GA status is permitted at v${EXPECTED_VERSION}`);
} catch (e) { fail(`compatibility manifest: cannot read to determine lifecycle state: ${e.message}`); }
const LC = EXPECTED_STATE ? LIFECYCLE[EXPECTED_STATE] : null;
const checkLifecycle = (label, obj) => {
  if (!LC || !obj) return;
  if (obj['x-cybrik-status'] !== LC.status) fail(`${label}: x-cybrik-status must be '${LC.status}' to match the manifest lifecycle (got '${obj['x-cybrik-status']}')`);
  if (obj['x-cybrik-not-accepted'] !== LC.notAccepted) fail(`${label}: x-cybrik-not-accepted must be ${LC.notAccepted} to match the manifest lifecycle`);
};

// ---------------------------------------------------------------------------
// 1. Load the 10 JSON Schema documents and register them with a single Ajv2020
//    instance keyed by $id. Cross-file relative $refs resolve against $id.
// ---------------------------------------------------------------------------
const SCHEMA_FILES = [
  'cybrik.common-defs.v1.schema.json',
  'cybrik.data-marking.v1.schema.json',
  'cybrik.envelope.v1.schema.json',
  'cybrik.capability.v1.schema.json',
  'cybrik.tool-execution-request.v1.schema.json',
  'cybrik.tool-execution-result.v1.schema.json',
  'cybrik.delegation-chain.v1.schema.json',
  'cybrik.execution-receipt.v1.schema.json',
  'cybrik.approval-request.v1.schema.json',
  'cybrik.approval-decision.v1.schema.json'
];

const PROPOSED_SCHEMA_FILES = [
  'cybrik.deployment-profile.v1.schema.json',
  'cybrik.platform-contract.v1.schema.json',
  'cybrik.provider-capability-advertisement.v1.schema.json',
  'cybrik.provider-capability-negotiation.v1.schema.json',
  'cybrik.offline-install-update-manifest.v1.schema.json',
  'cybrik.storage-s3-compatibility-subset.v1.schema.json'
];


// strict: true keeps genuine 2020-12 rigor (unknown-keyword typos, bad tuples, etc.), but we
// disable two ajv-SPECIFIC lints that flag idiomatic-and-spec-valid 2020-12 constructs:
//   - strictTypes: an allOf branch like {required:["tenant_id"]} needs no local "type":"object"
//     to be valid (required applies to object instances by definition).
//   - strictRequired: an if/then that requires a property defined on the PARENT (e.g. then:
//     {required:["approval_id"]}) is a standard conditional pattern, not a defect.
// These are ajv house-style heuristics beyond the JSON Schema 2020-12 spec; the schemas are
// spec-conformant. allowUnionTypes permits the spec-legal "type": ["object","array",...] unions.
const ajv = new Ajv2020({ strict: true, strictTypes: false, strictRequired: false, allErrors: true, allowUnionTypes: true });
addFormats(ajv);
// Annotation-only vendor keywords (status honesty markers). Declared so strict mode does not
// reject them as unknown, while every other strict check stays active.
for (const kw of ['x-cybrik-status', 'x-cybrik-not-accepted', 'x-cybrik-contract-version', 'x-cybrik-format-pins', 'x-cybrik-lifecycle']) {
  ajv.addKeyword({ keyword: kw });
}

const schemas = {}; // basename -> { doc, path }
const idByBasename = {};
for (const name of [...SCHEMA_FILES, ...PROPOSED_SCHEMA_FILES]) {
  const p = join(JSON_SCHEMA_DIR, name);
  if (!existsSync(p)) { fail(`missing schema file: json-schema/${name}`); continue; }
  let doc;
  try { doc = readJson(p); } catch (e) { fail(`json-schema/${name}: JSON parse error: ${e.message}`); continue; }
  schemas[name] = { doc, path: p };

  // 2. Standards metastructure per schema.
  if (doc.$schema !== DRAFT_2020) fail(`json-schema/${name}: $schema is not 2020-12 (${doc.$schema})`);
  if (typeof doc.$id !== 'string' || !doc.$id.startsWith(ID_PREFIX)) fail(`json-schema/${name}: $id missing/wrong prefix (${doc.$id})`);
  else idByBasename[name] = doc.$id;
  if (SCHEMA_FILES.includes(name)) {
    checkLifecycle(`json-schema/${name}`, doc);
  } else {
    if (doc['x-cybrik-status'] !== 'PROPOSED') fail(`json-schema/${name}: x-cybrik-status must be 'PROPOSED'`);
    if (doc['x-cybrik-not-accepted'] !== true) fail(`json-schema/${name}: x-cybrik-not-accepted must be true`);
  }
  const expectedContractVersion = name === 'cybrik.capability.v1.schema.json'
    ? CAPABILITY_VERSION
    : EXPECTED_VERSION;
  if (doc['x-cybrik-contract-version'] !== expectedContractVersion) {
    fail(`json-schema/${name}: contract-version must be ${expectedContractVersion}`);
  }
  bump('schemas_loaded');
}

// Register all before compiling so cross-file $refs resolve.
for (const [name, { doc }] of Object.entries(schemas)) {
  try { ajv.addSchema(doc); } catch (e) { fail(`json-schema/${name}: addSchema failed: ${e.message}`); }
}

// 3. Compile each — this resolves every local + cross-file $ref/$defs fragment. A dangling
//    ref throws here.
const validators = {}; // basename -> validate fn
for (const [name, { doc }] of Object.entries(schemas)) {
  if (!doc.$id) continue;
  try {
    validators[name] = ajv.getSchema(doc.$id) || ajv.compile(doc);
    bump('schemas_compiled');
  } catch (e) {
    fail(`json-schema/${name}: compile/ref-resolution failed: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// 4. Example fixtures, driven by examples/examples-manifest.json.
//    positive -> MUST validate; negative-schema -> MUST fail; negative-semantic -> MUST validate.
// ---------------------------------------------------------------------------
const EXAMPLES_DIR = join(CONTRACTS, 'examples');
const exManifestPath = join(EXAMPLES_DIR, 'examples-manifest.json');
let exManifest;
try { exManifest = readJson(exManifestPath); } catch (e) { fail(`examples-manifest.json: parse error: ${e.message}`); }

if (exManifest) {
  checkLifecycle('examples-manifest', exManifest);
  if (exManifest['x-cybrik-contract-version'] !== EXPECTED_VERSION) fail(`examples-manifest: x-cybrik-contract-version must be ${EXPECTED_VERSION}`);
  for (const ex of exManifest.examples || []) {
    const exPath = join(EXAMPLES_DIR, ex.file);
    if (!existsSync(exPath)) { fail(`example missing on disk: examples/${ex.file}`); continue; }
    const validate = validators[ex.schema];
    if (!validate) { fail(`example ${ex.file}: no compiled validator for schema ${ex.schema}`); continue; }
    let data;
    try { data = readJson(exPath); } catch (e) { fail(`example ${ex.file}: JSON parse error: ${e.message}`); continue; }
    const ok = validate(data);
    if (ex.kind === 'positive') {
      bump('positive_total');
      if (ok) { bump('positive_pass'); validatePlatformSemantics(data, ex.schema); }
      else fail(`positive example ${ex.file} FAILED validation against ${ex.schema}: ${ajv.errorsText(validate.errors)}`);
    } else if (ex.kind === 'negative-schema') {
      bump('negative_schema_total');
      if (!ok) bump('negative_schema_reject');
      else fail(`negative-schema example ${ex.file} unexpectedly VALIDATED against ${ex.schema} (must be rejected)`);
    } else if (ex.kind === 'negative-semantic') {
      bump('negative_semantic_total');
      if (ok) bump('negative_semantic_structurally_valid');
      else fail(`negative-semantic example ${ex.file} failed STRUCTURAL validation (must be structurally valid; only a runtime invariant rejects it): ${ajv.errorsText(validate.errors)}`);
    } else {
      fail(`example ${ex.file}: unknown kind '${ex.kind}'`);
    }
  }
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 4b. Platform Example fixtures.
// ---------------------------------------------------------------------------
const PLATFORM_EXAMPLES_DIR = join(CONTRACTS, 'examples/platform');
const platformPositives = [
  'onprem-airgap-v1.profile.json',
  'onprem-standard-v1.profile.json',
  'hybrid-sovereign-v1.profile.json',
  'private-cloud-v1.profile.json',
  'sample-platform-contract.json',
  'sample-provider-capability-advertisement.json',
  'sample-capability-negotiation-handshake.json',
  'sample-offline-bundle-manifest.json',
  'sample-storage-s3-subset.json',
  'sample-full-profile-conformance-declaration.json'
];

for (const file of platformPositives) {
  const exPath = join(PLATFORM_EXAMPLES_DIR, file);
  if (!existsSync(exPath)) { fail(`platform positive example missing on disk: ${file}`); continue; }

  let schemaName;
  if (file.includes('.profile.json')) schemaName = 'cybrik.deployment-profile.v1.schema.json';
  else if (file.includes('advertisement') || file.includes('declaration')) schemaName = 'cybrik.provider-capability-advertisement.v1.schema.json';
  else if (file.includes('negotiation') || file.includes('handshake')) schemaName = 'cybrik.provider-capability-negotiation.v1.schema.json';
  else if (file.includes('offline-bundle-manifest')) schemaName = 'cybrik.offline-install-update-manifest.v1.schema.json';
  else if (file.includes('platform-contract')) schemaName = 'cybrik.platform-contract.v1.schema.json';
  else if (file.includes('storage-s3-subset')) schemaName = 'cybrik.storage-s3-compatibility-subset.v1.schema.json';

  const validate = validators[schemaName];
  if (!validate) { fail(`platform example ${file}: no compiled validator for schema ${schemaName}`); continue; }
  let data;
  try {
    if (schemaName.includes('offline-install-update-manifest')) {
      const rawBuffer = readFileSync(exPath);
      validateIJson(rawBuffer, file);
      data = JSON.parse(rawBuffer.toString('utf8'));
    } else {
      const rawContent = readFileSync(exPath, 'utf8');
      data = JSON.parse(rawContent);
    }
  } catch (e) { fail(`platform example ${file}: JSON parse error: ${e.message}`); continue; }
  const ok = validate(data);
  bump('positive_total');
  if (ok) { bump('positive_pass'); validatePlatformSemantics(data, schemaName); }
  else fail(`platform positive example ${file} FAILED validation against ${schemaName}: ${ajv.errorsText(validate.errors)}`);
}

const EXPECTED_PLATFORM_NEGATIVES = {
  'invalid-absolute-path-offline-manifest.json': { keyword: 'pattern', instancePath: '/artifacts/0/path', schemaPath: '#/properties/artifacts/items/properties/path/pattern', params: { pattern: '^(?!\\/)(?!^\\.\\/)(?!.*\\.\\.)(?!.*(?:\\/\\.|\\/\\/|\\/$))[a-z0-9._/-]+[a-z0-9._-]$' }, message: 'must match pattern "^(?!\\/)(?!^\\.\\/)(?!.*\\.\\.)(?!.*(?:\\/\\.|\\/\\/|\\/$))[a-z0-9._/-]+[a-z0-9._-]$"' },
  'invalid-bare-tier-profile.json': { keyword: 'pattern', instancePath: '/profile_id', schemaPath: '#/properties/profile_id/pattern', params: { pattern: '^(?!^[tT][012]$)[a-z0-9][a-z0-9-_]+$' }, message: 'must match pattern "^(?!^[tT][012]$)[a-z0-9][a-z0-9-_]+$"' },
  'invalid-empty-trust-root-offline-manifest.json': { keyword: 'required', instancePath: '', schemaPath: '#/required', params: { missingProperty: 'operator_trust_root' }, message: "must have required property 'operator_trust_root'" },
  'invalid-leading-zero-semver.json': { keyword: 'pattern', instancePath: '/profile_version', schemaPath: '#/properties/profile_version/pattern', params: { pattern: '^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$' }, message: 'must match pattern "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$"' },
  'invalid-lowercase-tier-profile.json': { keyword: 'pattern', instancePath: '/profile_id', schemaPath: '#/properties/profile_id/pattern', params: { pattern: '^(?!^[tT][012]$)[a-z0-9][a-z0-9-_]+$' }, message: 'must match pattern "^(?!^[tT][012]$)[a-z0-9][a-z0-9-_]+$"' },
  'invalid-missing-evidence-advertisement.json': { keyword: 'minItems', instancePath: '/conformance_evidence', schemaPath: '#/properties/conformance_evidence/minItems', params: { limit: 1 }, message: 'must NOT have fewer than 1 items' },
  'invalid-namespace-advertisement.json': { keyword: 'pattern', instancePath: '/provider_namespace', schemaPath: '#/properties/provider_namespace/pattern', params: { pattern: '^[a-z0-9][a-z0-9-_]*[a-z0-9]$' }, message: 'must match pattern "^[a-z0-9][a-z0-9-_]*[a-z0-9]$"' },
  'invalid-platform-all-false.json': { keyword: 'const', instancePath: '/slots/oci_container_runtime/specification/required', schemaPath: '#/properties/slots/properties/oci_container_runtime/properties/specification/properties/required/const', params: { allowedValue: true }, message: "must be equal to constant" },
  'invalid-s3-missing-crud.json': { keyword: 'minItems', instancePath: '/required_operations', schemaPath: '#/properties/required_operations/minItems', params: { limit: 17 }, message: 'must NOT have fewer than 17 items' },
  'invalid-unauthenticated-advertisement.json': { keyword: 'const', instancePath: '/authenticated_discovery', schemaPath: '#/properties/authenticated_discovery/const', params: { allowedValue: true }, message: 'must be equal to constant' },
  'invalid-zero-artifacts-offline-manifest.json': { keyword: 'minItems', instancePath: '/artifacts', schemaPath: '#/properties/artifacts/minItems', params: { limit: 1 }, message: 'must NOT have fewer than 1 items' },
  'malformed-sha256-offline-manifest.json': { keyword: 'pattern', instancePath: '/artifacts/0/sha256', schemaPath: '#/properties/artifacts/items/properties/sha256/pattern', params: { pattern: '^[a-f0-9]{64}$' }, message: 'must match pattern "^[a-f0-9]{64}$"' },
  'missing-slot-profile.json': { keyword: 'required', instancePath: '/capability_set', schemaPath: '#/properties/capability_set/required', params: { missingProperty: 'artifact_update_mechanism' }, message: "must have required property 'artifact_update_mechanism'" }
};

if (existsSync(join(PLATFORM_EXAMPLES_DIR, 'negative'))) {
  const negFiles = readdirSync(join(PLATFORM_EXAMPLES_DIR, 'negative')).filter(f => f.endsWith('.json'));
  if (negFiles.length !== Object.keys(EXPECTED_PLATFORM_NEGATIVES).length) {
    fail(`platform negative examples count mismatch: expected ${Object.keys(EXPECTED_PLATFORM_NEGATIVES).length}, got ${negFiles.length}`);
  }
  for (const file of negFiles) {
    const exPath = join(PLATFORM_EXAMPLES_DIR, 'negative', file);

    let schemaName;
    if (file.includes('profile') || file.includes('semver')) schemaName = 'cybrik.deployment-profile.v1.schema.json';
    else if (file.includes('advertisement') || file.includes('declaration')) schemaName = 'cybrik.provider-capability-advertisement.v1.schema.json';
    else if (file.includes('negotiation') || file.includes('handshake')) schemaName = 'cybrik.provider-capability-negotiation.v1.schema.json';
    else if (file.includes('offline-manifest') || file.includes('malformed-sha256') || file.includes('trust-root')) schemaName = 'cybrik.offline-install-update-manifest.v1.schema.json';
    else if (file.includes('platform')) schemaName = 'cybrik.platform-contract.v1.schema.json';
    else if (file.includes('s3')) schemaName = 'cybrik.storage-s3-compatibility-subset.v1.schema.json';

    const validate = validators[schemaName];
    if (!validate) { fail(`platform negative example ${file}: no compiled validator for schema ${schemaName}`); continue; }
    let data;
    try {
      if (schemaName.includes('offline-install-update-manifest')) {
        const rawBuffer = readFileSync(exPath);
        validateIJson(rawBuffer, file);
        data = JSON.parse(rawBuffer.toString('utf8'));
      } else {
        data = readJson(exPath);
      }
    } catch (e) { fail(`platform negative example ${file}: JSON parse error: ${e.message}`); continue; }

    const ok = validate(data);
    bump('negative_schema_total');
    if (!ok) {
      bump('negative_schema_reject');
      if (validate.errors.length !== 1) {
        fail(`platform negative example ${file}: expected exactly 1 error, got ${validate.errors.length}`);
      }
      const expected = EXPECTED_PLATFORM_NEGATIVES[file];
      if (!expected) {
        fail(`platform negative example ${file}: no expected invariant/error mapped!`);
      } else {
        const actualErr = validate.errors[0];
        if (actualErr.keyword !== expected.keyword || actualErr.instancePath !== expected.instancePath || actualErr.schemaPath !== expected.schemaPath || JSON.stringify(actualErr.params) !== JSON.stringify(expected.params) || actualErr.message !== expected.message) {
          fail(`platform negative example ${file}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actualErr)}`);
        }
      }
    } else {
      fail(`platform negative example ${file} unexpectedly VALIDATED against ${schemaName} (must be rejected)`);
    }
  }
}

// ---------------------------------------------------------------------------
// 4c. Storage S3 Subset Example fixtures & conformance assertions (OPEN-2).
// ---------------------------------------------------------------------------
const STORAGE_EXAMPLES_DIR = join(CONTRACTS, 'examples/storage');
const S3_SCHEMA_ID = 'https://contracts.cybrik.example/cybrik.storage-s3-compatibility-subset.v1.schema.json';
const S3_PROFILE_DEF_ID = `${S3_SCHEMA_ID}#/$defs/storageConformanceProfile`;
const S3_RETENTION_DEF_ID = `${S3_SCHEMA_ID}#/$defs/objectRetentionCompliance`;
const S3_EVIDENCE_DEF_ID = `${S3_SCHEMA_ID}#/$defs/storageConformanceEvidence`;
const S3_MULTIPART_DEF_ID = `${S3_SCHEMA_ID}#/$defs/multipartUploadManifest`;
const S3_RETENTION_MODE_DEF_ID = `${S3_SCHEMA_ID}#/$defs/retentionMode`;
const S3_LEGAL_HOLD_DEF_ID = `${S3_SCHEMA_ID}#/$defs/legalHoldStatus`;
const S3_BUCKET_NAME_DEF_ID = `${S3_SCHEMA_ID}#/$defs/bucketName`;
const S3_OBJECT_KEY_DEF_ID = `${S3_SCHEMA_ID}#/$defs/objectKey`;
const S3_URI_DEF_ID = `${S3_SCHEMA_ID}#/$defs/s3Uri`;
const S3_PATH_STYLE_URL_DEF_ID = `${S3_SCHEMA_ID}#/$defs/pathStyleUrl`;
const S3_OP_DEF_ID = `${S3_SCHEMA_ID}#/$defs/s3Operation`;

const storagePositives = [
  { file: 's3-storage-conformance-profile.json', schemaId: S3_PROFILE_DEF_ID, alsoRoot: true },
  { file: 's3-object-retention-compliance.json', schemaId: S3_RETENTION_DEF_ID, alsoDef: S3_EVIDENCE_DEF_ID },
  { file: 's3-multipart-upload-manifest.json', schemaId: S3_MULTIPART_DEF_ID }
];

for (const pos of storagePositives) {
  const exPath = join(STORAGE_EXAMPLES_DIR, 'positive', pos.file);
  if (!existsSync(exPath)) { fail(`storage positive example missing on disk: ${pos.file}`); continue; }
  let data;
  try { data = readJson(exPath); } catch (e) { fail(`storage positive example ${pos.file}: JSON parse error: ${e.message}`); continue; }

  const ok = ajv.validate(pos.schemaId, data);
  bump('positive_total');
  if (ok) {
    bump('positive_pass');
    validatePlatformSemantics(data, pos.schemaId);
  } else {
    fail(`storage positive example ${pos.file} FAILED validation against ${pos.schemaId}: ${ajv.errorsText(ajv.errors)}`);
  }

  if (pos.alsoRoot) {
    const rootOk = ajv.validate(S3_SCHEMA_ID, data);
    bump('positive_total');
    if (rootOk) bump('positive_pass');
    else fail(`storage positive example ${pos.file} FAILED validation against root schema: ${ajv.errorsText(ajv.errors)}`);
  }
  if (pos.alsoDef) {
    const defOk = ajv.validate(pos.alsoDef, data);
    bump('positive_total');
    if (defOk) bump('positive_pass');
    else fail(`storage positive example ${pos.file} FAILED validation against ${pos.alsoDef}: ${ajv.errorsText(ajv.errors)}`);
  }
}

const EXPECTED_STORAGE_NEGATIVES = {
  'invalid-s3-unsupported-operation.json': {
    schemaId: S3_PROFILE_DEF_ID,
    keyword: 'enum',
    instancePath: '/required_operations/16'
  },
  'invalid-s3-missing-retention-mode.json': {
    schemaId: S3_RETENTION_DEF_ID,
    keyword: 'required',
    instancePath: '',
    missingProperty: 'retention_mode'
  },
  'invalid-s3-missing-version-id-evidence.json': {
    schemaId: S3_RETENTION_DEF_ID,
    keyword: 'required',
    instancePath: '',
    missingProperty: 'version_id'
  },
  'invalid-s3-malformed-digest.json': {
    schemaId: S3_MULTIPART_DEF_ID,
    keyword: 'pattern',
    instancePath: '/parts/0/sha256'
  },
  'invalid-s3-dot-segment-path.json': {
    schemaId: S3_RETENTION_DEF_ID,
    keyword: 'pattern',
    instancePath: '/object_key'
  },
  'invalid-s3-unsupported-error-code.json': {
    schemaId: S3_PROFILE_DEF_ID,
    keyword: 'enum',
    instancePath: '/required_error_codes/11'
  },
  'invalid-s3-missing-mandatory-op.json': {
    schemaId: S3_PROFILE_DEF_ID,
    keyword: 'minItems',
    instancePath: '/required_operations'
  }
};

const EXPECTED_STORAGE_DISPATCH_NEGATIVES = {
  'invalid-s3-dispatch-mismatched-content-md5.json': {
    http_status: 400,
    error_code: 'BadDigest',
    error_condition: 'PAYLOAD_DIGEST_MISMATCH'
  },
  'invalid-s3-dispatch-malformed-content-md5-header.json': {
    http_status: 400,
    error_code: 'InvalidDigest',
    error_condition: 'MALFORMED_DIGEST_HEADER'
  }
};

if (existsSync(join(STORAGE_EXAMPLES_DIR, 'negative'))) {
  const storageNegFiles = readdirSync(join(STORAGE_EXAMPLES_DIR, 'negative')).filter(f => f.endsWith('.json'));
  const expectedTotalCount = Object.keys(EXPECTED_STORAGE_NEGATIVES).length + Object.keys(EXPECTED_STORAGE_DISPATCH_NEGATIVES).length;
  if (storageNegFiles.length !== expectedTotalCount) {
    fail(`storage negative examples count mismatch: expected ${expectedTotalCount}, got ${storageNegFiles.length}`);
  }
  for (const file of storageNegFiles) {
    const exPath = join(STORAGE_EXAMPLES_DIR, 'negative', file);

    if (EXPECTED_STORAGE_DISPATCH_NEGATIVES[file]) {
      const expDispatch = EXPECTED_STORAGE_DISPATCH_NEGATIVES[file];
      let data;
      try { data = readJson(exPath); } catch (e) { fail(`storage dispatch negative example ${file}: JSON parse error: ${e.message}`); continue; }
      bump('negative_schema_total');
      if (data.http_status !== expDispatch.http_status || data.error_code !== expDispatch.error_code) {
        fail(`storage dispatch negative example ${file}: expected status ${expDispatch.http_status} / code ${expDispatch.error_code}, got ${data.http_status} / ${data.error_code}`);
      } else {
        bump('negative_schema_reject');
      }
      continue;
    }

    const expected = EXPECTED_STORAGE_NEGATIVES[file];
    if (!expected) {
      fail(`storage negative example ${file}: no expected invariant/error mapped!`);
      continue;
    }
    let data;
    try { data = readJson(exPath); } catch (e) { fail(`storage negative example ${file}: JSON parse error: ${e.message}`); continue; }

    const ok = ajv.validate(expected.schemaId, data);
    bump('negative_schema_total');
    if (!ok) {
      bump('negative_schema_reject');
      if (ajv.errors.length !== 1) {
        fail(`storage negative example ${file}: expected exactly 1 error, got ${ajv.errors.length}: ${JSON.stringify(ajv.errors)}`);
      } else {
        const actualErr = ajv.errors[0];
        if (actualErr.keyword !== expected.keyword || actualErr.instancePath !== expected.instancePath) {
          fail(`storage negative example ${file}: expected keyword ${expected.keyword} at ${expected.instancePath}, got ${actualErr.keyword} at ${actualErr.instancePath}`);
        }
        if (expected.missingProperty && actualErr.params?.missingProperty !== expected.missingProperty) {
          fail(`storage negative example ${file}: expected missingProperty ${expected.missingProperty}, got ${actualErr.params?.missingProperty}`);
        }
      }
    } else {
      fail(`storage negative example ${file} unexpectedly VALIDATED against ${expected.schemaId} (must be rejected)`);
    }
  }
}

// 5. Compatibility / version / status manifest.
// ---------------------------------------------------------------------------
const compatPath = join(CONTRACTS, 'compatibility', 'cybrik-suite-contract-packet.v1.manifest.json');
let compat;
try { compat = readJson(compatPath); } catch (e) { fail(`compatibility manifest: parse error: ${e.message}`); }
if (compat) {
  checkLifecycle('compatibility manifest', compat);
  if (compat['x-cybrik-packet-version'] !== EXPECTED_PACKET_VERSION) {
    fail(`compatibility manifest: packet-version must be ${EXPECTED_PACKET_VERSION}`);
  }
  // is-bundle-tag stays false in BOTH states: snapshot v0.1.1 is not immutable or stable v1/GA.
  if (compat['x-cybrik-is-bundle-tag'] !== false) {
    fail('compatibility manifest: is-bundle-tag must be false (snapshot v0.1.1 is never an immutable bundle tag / GA)');
  }
  const accStatus = compat.acceptance?.status || '';
  if (EXPECTED_STATE === 'PROPOSED') {
    if (!/NOT ACCEPTED/.test(accStatus)) fail('compatibility manifest: acceptance.status must state NOT ACCEPTED while PROPOSED');
  } else {
    // ACCEPTED FOR IMPLEMENTATION: acceptance must be affirmative, Founder-gated, and evidenced.
    if (!/ACCEPTED FOR IMPLEMENTATION/.test(accStatus)) fail('compatibility manifest: acceptance.status must state ACCEPTED FOR IMPLEMENTATION');
    if (/\bNOT ACCEPTED\b/.test(accStatus)) fail('compatibility manifest: acceptance.status must not still say NOT ACCEPTED once accepted');
    const a = compat.acceptance || {};
    if (!a.gate) fail('compatibility manifest: accepted packet must record acceptance.gate');
    if (!a.decided_by) fail('compatibility manifest: accepted packet must record acceptance.decided_by (Founder-delegated; not agent-inferred)');
    if (!a.decided_on) fail('compatibility manifest: accepted packet must record acceptance.decided_on');
    if (!Array.isArray(a.evidence) || a.evidence.length === 0) fail('compatibility manifest: accepted packet must record acceptance.evidence[]');
  }
  const pins = compat.format_pins || {};
  if (pins.jsonSchema !== '2020-12') fail('compatibility manifest: jsonSchema pin must be 2020-12');
  if (pins.openApi !== '3.1.x') fail('compatibility manifest: openApi pin must be 3.1.x');
  if (pins.asyncApi !== '3.0.0') fail('compatibility manifest: asyncApi pin must be 3.0.0');
  // Checker-gap fix: the mcp pin is asserted here AND against common-defs x-cybrik-format-pins.
  if (pins.mcp !== '2025-11-25') fail('compatibility manifest: mcp pin must be 2025-11-25');
  const cdPins = schemas['cybrik.common-defs.v1.schema.json']?.doc?.['x-cybrik-format-pins'] || {};
  if (cdPins.mcp !== '2025-11-25') fail('common-defs: x-cybrik-format-pins.mcp must be 2025-11-25');
  for (const m of compat.members || []) {
    const mp = join(CONTRACTS, m.file);
    const expectedMemberVersion = m.file === CAPABILITY_FILE ? CAPABILITY_VERSION : EXPECTED_VERSION;
    if (!existsSync(mp)) {
      fail(`compatibility manifest: member file missing: ${m.file}`);
    } else {
      const expectedHash = createHash('sha256').update(readFileSync(mp)).digest('hex');
      if (m.sha256 !== expectedHash) {
        fail(`compatibility manifest: member ${m.file} sha256 must be ${expectedHash}`);
      } else {
        bump('manifest_member_hashes_verified');
      }
    }
    if (m.contract_version !== expectedMemberVersion) {
      fail(`compatibility manifest: member ${m.file} contract_version must be ${expectedMemberVersion}`);
    }
    bump('manifest_members');
  }
  // Hardening #10: monotonicity invariants recorded as runtime obligations.
  if (!Array.isArray(compat.monotonicity_invariants?.rules) || compat.monotonicity_invariants.rules.length === 0) {
    fail('HARDENING#10: manifest.monotonicity_invariants.rules missing/empty');
  }
}

// ---------------------------------------------------------------------------
// 6. Wire-spec external $ref integrity + two YAML-resident hardenings.
// ---------------------------------------------------------------------------
const openapiPath = join(CONTRACTS, 'openapi', 'cybrik-fabric-control-plane.v1.openapi.yaml');
const asyncapiPath = join(CONTRACTS, 'asyncapi', 'cybrik-suite-events.v1.asyncapi.yaml');
let openapi, asyncapi;
try { openapi = readYaml(openapiPath); } catch (e) { fail(`openapi YAML parse error: ${e.message}`); }
try { asyncapi = readYaml(asyncapiPath); } catch (e) { fail(`asyncapi YAML parse error: ${e.message}`); }

// Cross-file lifecycle consistency for the wire specs and the MCP notes, so a
// partially-flipped packet cannot pass. OpenAPI/AsyncAPI carry the marker triple
// in info; the MCP notes are markdown, so assert the header Status line textually.
if (openapi?.info) checkLifecycle('openapi info', openapi.info);
if (asyncapi?.info) checkLifecycle('asyncapi info', asyncapi.info);
if (EXPECTED_STATE) {
  try {
    const mcpText = readFileSync(join(CONTRACTS, 'mcp', 'cybrik-mcp-mapping-notes.v1.md'), 'utf8');
    if (EXPECTED_STATE === 'PROPOSED') {
      if (!/Status:\s*`PROPOSED`\s*—\s*\*\*NOT ACCEPTED\*\*/.test(mcpText)) fail('mcp notes: header Status must read `PROPOSED` — **NOT ACCEPTED** to match the lifecycle');
    } else if (!/Status:\s*\*\*ACCEPTED FOR IMPLEMENTATION\*\*/.test(mcpText)) {
      fail('mcp notes: header Status must read **ACCEPTED FOR IMPLEMENTATION** to match the lifecycle');
    }
  } catch (e) { fail(`mcp notes: cannot read to check lifecycle: ${e.message}`); }
}

// Collect every $ref string recursively.
const collectRefs = (node, acc) => {
  if (Array.isArray(node)) { for (const v of node) collectRefs(v, acc); }
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === '$ref' && typeof v === 'string') acc.push(v);
      else collectRefs(v, acc);
    }
  }
  return acc;
};

const ptrResolve = (docObj, pointer) => {
  if (!pointer) return docObj;
  const parts = pointer.replace(/^#/, '').split('/').filter(Boolean).map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));
  let cur = docObj;
  for (const part of parts) { if (cur == null || !(part in cur)) return undefined; cur = cur[part]; }
  return cur;
};

const checkFileRefs = (label, docObj, docDir) => {
  const refs = collectRefs(docObj, []);
  for (const ref of refs) {
    bump('wire_refs_total');
    if (ref.startsWith('#')) continue; // internal, resolved by the spec validators
    const [filePart, frag] = ref.split('#');
    const target = resolve(docDir, filePart);
    // Containment: a $ref must stay inside contracts/. Contract YAML is contributor-editable,
    // so a malicious external $ref (e.g. ../../../../etc/passwd) must never cause a read
    // outside the packet — a parse error on such a file could otherwise echo its contents to
    // public CI logs. Escaping refs are a validation failure, not a filesystem read.
    const CONTRACTS_ROOT = resolve(CONTRACTS);
    if (target !== CONTRACTS_ROOT && !target.startsWith(CONTRACTS_ROOT + sep)) {
      fail(`${label}: external $ref escapes contracts/ (refused): ${ref}`); continue;
    }
    if (!existsSync(target)) { fail(`${label}: dangling external $ref, file not found: ${ref}`); continue; }
    if (frag) {
      let tdoc;
      try { tdoc = target.endsWith('.json') ? readJson(target) : readYaml(target); } catch (e) { fail(`${label}: cannot parse $ref target ${filePart}: ${e.message}`); continue; }
      if (ptrResolve(tdoc, frag) === undefined) fail(`${label}: dangling fragment $ref (pointer not found): ${ref}`);
    }
    bump('wire_refs_external_resolved');
  }
};
if (openapi) checkFileRefs('openapi', openapi, join(CONTRACTS, 'openapi'));
if (asyncapi) checkFileRefs('asyncapi', asyncapi, join(CONTRACTS, 'asyncapi'));

// ---------------------------------------------------------------------------
// 7. The 10 security hardenings as explicit, brittle-on-purpose assertions.
//    A regression that relaxes any hardening fails CI here.
// ---------------------------------------------------------------------------
const doc = (n) => schemas[n]?.doc;
const req = (o) => (o && Array.isArray(o.required)) ? o.required : [];
const hasTenantIdAllOf = (node) =>
  node && Array.isArray(node.allOf) && node.allOf.some((m) => Array.isArray(m.required) && m.required.includes('tenant_id'));
const H = (id, cond, msg) => { bump('hardenings_checked'); if (cond) bump('hardenings_ok'); else fail(`HARDENING#${id}: ${msg}`); };

// #1 idempotency_key minLength 16 (request schema + OpenAPI param).
const ter = doc('cybrik.tool-execution-request.v1.schema.json');
H(1, ter?.properties?.idempotency_key?.minLength === 16, 'tool-execution-request idempotency_key.minLength must be 16');
const idemParam = openapi?.components?.parameters?.IdempotencyKey?.schema?.minLength;
H('1b', idemParam === 16, `OpenAPI IdempotencyKey param minLength must be 16 (got ${idemParam})`);

// #2 actor.tenant_id required at the 5 cross-tenant authz sites.
H('2a', hasTenantIdAllOf(ter?.properties?.actor), 'tool-execution-request.actor must require tenant_id');
const del = doc('cybrik.delegation-chain.v1.schema.json');
H('2b', hasTenantIdAllOf(del?.$defs?.grant?.properties?.issuer), 'delegation grant.issuer must require tenant_id');
H('2c', hasTenantIdAllOf(del?.$defs?.grant?.properties?.subject), 'delegation grant.subject must require tenant_id');
H('2d', hasTenantIdAllOf(doc('cybrik.approval-request.v1.schema.json')?.properties?.requested_by), 'approval-request.requested_by must require tenant_id');
H('2e', hasTenantIdAllOf(doc('cybrik.approval-decision.v1.schema.json')?.properties?.decided_by), 'approval-decision.decided_by must require tenant_id');
// common-defs must define tenantId.
H('2f', !!doc('cybrik.common-defs.v1.schema.json')?.$defs?.tenantId, 'common-defs must define $defs.tenantId');

// #3 tool-execution-result.tenant_id required.
H(3, req(doc('cybrik.tool-execution-result.v1.schema.json')).includes('tenant_id'), 'tool-execution-result must require tenant_id');

// #4 approval-decision.delegation_ref required.
H(4, req(doc('cybrik.approval-decision.v1.schema.json')).includes('delegation_ref'), 'approval-decision must require delegation_ref');

// #5 capability.network_policy required + broker_allowlist => limits.max_egress_bytes.
const cap = doc('cybrik.capability.v1.schema.json');
H('5a', req(cap).includes('network_policy'), 'capability must require network_policy');
const capAllOf = JSON.stringify(cap?.allOf || []);
H('5b', capAllOf.includes('broker_allowlist') && capAllOf.includes('max_egress_bytes'), 'capability must conditionally require limits.max_egress_bytes when network_policy=broker_allowlist');

// #6 delegation scope.max_risk_class required.
H(6, req(del?.$defs?.grant?.properties?.scope).includes('max_risk_class'), 'delegation grant.scope must require max_risk_class');

// #7 execution-receipt performed=true => target_digest required.
const rcptSide = doc('cybrik.execution-receipt.v1.schema.json')?.properties?.side_effect;
const sideAllOf = JSON.stringify(rcptSide?.allOf || []);
H(7, sideAllOf.includes('target_digest') && sideAllOf.includes('performed'), 'execution-receipt side_effect must require target_digest when performed=true');

// #8 tool-execution-request.data_marking required.
H(8, req(ter).includes('data_marking'), 'tool-execution-request must require data_marking');

// #9 AsyncAPI per-message data payloads bound; kill_switch data deferred (fail-closed).
const msgs = asyncapi?.components?.messages || {};
const dataBound = (m) => Array.isArray(m?.payload?.allOf) && m.payload.allOf.some((e) => Array.isArray(e.required) && e.required.includes('data'));
for (const key of ['alertSnapshotCreated', 'invocationRequested', 'invocationCompleted', 'approvalRequired', 'approvalDecided']) {
  H(`9:${key}`, dataBound(msgs[key]), `AsyncAPI message ${key} must bind a typed data payload (allOf requiring data)`);
}
const kill = msgs.killSwitchChanged;
H('9:kill', !!kill?.payload?.$ref && !kill?.payload?.allOf, 'AsyncAPI killSwitchChanged data must remain deferred (envelope-only, no data binding)');

// #H1 (W2B-H1) — approval-decision.decided_by is constrained to a HUMAN. A schema-
// enforceable human-in-the-loop control: decided_by.type MUST be const "user", so an
// agent/service identity can never decide an approval (SoD alone would miss this).
const apprDec = doc('cybrik.approval-decision.v1.schema.json')?.properties?.decided_by;
const decidedByUserConst = Array.isArray(apprDec?.allOf) && apprDec.allOf.some((m) => m?.properties?.type?.const === 'user');
H('H1', decidedByUserConst, 'approval-decision.decided_by MUST constrain type to const "user" (human-in-the-loop; no agent/service approver)');

// #H2 (W2B-H2) — delegation min-ceiling / non-escalation is BOTH defined in the manifest
// and exercised by the fixtures. Risk order R0<R1<R2<R3. chainEscalates() returns true iff
// some grant[i>=1] exceeds the running minimum ceiling of its predecessors (an elevation).
const RISK = { R0: 0, R1: 1, R2: 2, R3: 3 };
const chainEscalates = (chain) => {
  const grants = chain?.grants || [];
  let runningMin = Infinity;
  for (let i = 0; i < grants.length; i++) {
    const cls = RISK[grants[i]?.scope?.max_risk_class];
    if (cls === undefined) return false; // malformed shape is reported by schema validation
    if (i >= 1 && cls > runningMin) return true; // grant[i] raises above min(predecessors) => escalation
    runningMin = Math.min(runningMin, cls);
  }
  return false;
};
const ce = compat?.monotonicity_invariants?.chain_evaluation;
const ceText = JSON.stringify(ce || {});
H('H2a', !!ce && /MIN/i.test(ceText) && /MUST NOT/i.test(ceText) && /(approver_co_grant|co-grant)/i.test(ceText),
  'manifest.monotonicity_invariants.chain_evaluation must define the MIN effective ceiling and that an approver co-grant MUST NOT elevate it');
let posChain, negEscChain;
try { posChain = readJson(join(EXAMPLES_DIR, 'positive/delegation-chain.json')); } catch { /* reported by example loop */ }
try { negEscChain = readJson(join(EXAMPLES_DIR, 'negative/delegation-chain.privilege-escalation.json')); } catch { /* reported by example loop */ }
H('H2b', !!posChain && !chainEscalates(posChain), 'positive delegation-chain fixture must be NON-escalating (no grant exceeds the running minimum ceiling)');
H('H2c', !!negEscChain && chainEscalates(negEscChain), 'negative privilege-escalation fixture MUST actually escalate (a co-grant exceeding the root ceiling), proving the min-ceiling rule is exercised');

// ---------------------------------------------------------------------------
// Summary

// #10 verify FULL_PROFILE_CONFORMANCE_DECLARATION distinct slots
const pcaSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';

const originalPca = readJson(join(PLATFORM_EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json'));
const pcaData = JSON.parse(JSON.stringify(originalPca));
pcaData.advertised_capabilities[1].slot_id = pcaData.advertised_capabilities[0].slot_id;

const pcaValid = ajv.validate(pcaSchemaId, pcaData);
const pcaHasContains = !pcaValid && ajv.errors.some(e => e.keyword === 'contains');
const pcaHasNoDigestErr = !pcaValid && !ajv.errors.some(e => e.keyword === 'required' && e.params?.missingProperty === 'target_profile_digest');

H('10', !pcaValid && pcaHasContains && pcaHasNoDigestErr, 'FULL_PROFILE_CONFORMANCE_DECLARATION with duplicated distinct slot must be rejected via contains keyword');

// 11. in-memory validation: reject advertisement with unresolvable evidence reference (referential integrity)
const pcaUnresolvable = {
  target_profile_id: "onprem-standard-v1",
  target_profile_version: "1.0.0",
  provider_namespace: "evil-corp",
  claim_type: "PARTIAL_CAPABILITY_ADVERTISEMENT",
  advertised_capabilities: [
    {
      capability_name: "cap-storage",
      slot_id: "storage",
      description: "Storage slot",
      evidence_references: ["urn:cybrik:evidence:missing-test"]
    }
  ],
  conformance_evidence: [
    {
      test_identifier: "urn:cybrik:evidence:test-1",
      status: "PASS",
      evidence_pack_digest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      executed_at: "2026-08-25T12:00:00Z",
      report_uri: "https://example.com/report"
    }
  ],
  degradation_behavior: "FAIL_CLOSED",
  authenticated_discovery: true
};
try {
  validatePlatformSemantics(pcaUnresolvable, pcaSchemaId);
  fail('referential integrity: expected validatePlatformSemantics to throw on missing evidence reference');
} catch (e) {
  H('11', e.message.includes('missing-test'), 'referential integrity check must catch missing evidence references');
}

// 18. in-memory validation: reject FULL_PROFILE_CONFORMANCE_DECLARATION with mismatched digest
const pcaBadDigest = JSON.parse(JSON.stringify(readJson(join(PLATFORM_EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json'))));
pcaBadDigest.target_profile_digest = "0000000000000000000000000000000000000000000000000000000000000000";
try {
  validatePlatformSemantics(pcaBadDigest, pcaSchemaId);
  fail('digest binding: expected validatePlatformSemantics to throw on mismatched digest');
} catch (e) {
  H('18', e.message.includes('does not match disk profile digest') || e.message.includes('does not match actual digest'), 'digest binding check must catch mismatched target profile digest');
}

// 18b. in-memory validation: reject advertisement_response / negotiation with missing or malformed target_profile_digest
const handshakeSample = readJson(join(PLATFORM_EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'));
const pcnBadDigestPattern = JSON.parse(JSON.stringify(handshakeSample));
pcnBadDigestPattern.target_profile_digest = "not-a-valid-hex-digest";
let pcnBadDigestPatternCaught = false;
try {
  validatePlatformSemantics(pcnBadDigestPattern, 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json');
} catch (e) {
  pcnBadDigestPatternCaught = e.message.includes('target_profile_digest');
}
const pcnMissingDigestSem = JSON.parse(JSON.stringify(handshakeSample));
delete pcnMissingDigestSem.target_profile_digest;
let pcnMissingDigestSemCaught = false;
try {
  validatePlatformSemantics(pcnMissingDigestSem, 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json');
} catch (e) {
  pcnMissingDigestSemCaught = e.message.includes('target_profile_digest');
}
H('18b', pcnBadDigestPatternCaught && pcnMissingDigestSemCaught, 'advertisement_response / negotiation missing or malformed target_profile_digest must fail validatePlatformSemantics');

// 12. in-memory validation: reject offline manifest with duplicate artifact paths (path uniqueness)
const manifestSchemaId = 'https://contracts.cybrik.example/cybrik.offline-install-update-manifest.v1.schema.json';
const dupManifest = {
  bundle_identifier: "my-bundle-1",
  release_tag: "v1.2.3",
  manifest_sequence: 1,
  operator_trust_root: {
    signing_key_id: "key-123456",
    public_key_fingerprint: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    signature_algorithm: "ed25519"
  },
  detached_signature: {
    algorithm: "ed25519",
    signature_file: "manifest.sig",
    key_fingerprint: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  },
  artifacts: [
    {
      name: "image-1",
      path: "images/image-1.tar",
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      size_bytes: 1024
    },
    {
      name: "image-2",
      path: "images/image-1.tar",
      sha256: "0000000000000000000000000000000000000000000000000000000000000000",
      size_bytes: 2048
    }
  ],
  migration_reversibility_guaranteed: true,
  rollback_procedure_reference: "doc://rollback",
  update_station_workflow: {
    preflight_steps: [
      {
        step_id: "preflight-verify",
        action: "VERIFY_DIGEST",
        target: "images/image-1.tar"
      }
    ],
    apply_steps: [
      {
        step_id: "apply-preload",
        action: "PRELOAD_OCI_IMAGE",
        target: "images/image-1.tar"
      }
    ],
    rollback_steps: [
      {
        step_id: "rollback-restore",
        action: "RESTORE_DATABASE_SNAPSHOT",
        target: "snapshots/backup.db"
      }
    ]
  },
  canonicalization_scheme: "RFC_8785_JCS"
};
try {
  validatePlatformSemantics(dupManifest, manifestSchemaId);
  fail('path uniqueness: expected validatePlatformSemantics to throw on duplicate paths');
} catch (e) {
  H('12', e.message.includes('duplicate artifact path'), 'path uniqueness check must catch duplicate artifact paths');
}

// 12b. in-memory validation: reject offline manifest with double-slash or leading-dot snapshot restore targets in validatePlatformSemantics
const badRestoreDoubleSlashManifest = JSON.parse(JSON.stringify(dupManifest));
badRestoreDoubleSlashManifest.artifacts = [dupManifest.artifacts[0]];
badRestoreDoubleSlashManifest.update_station_workflow.rollback_steps[0].target = "snapshots//backup.db";
let badRestoreDoubleSlashCaught = false;
try {
  validatePlatformSemantics(badRestoreDoubleSlashManifest, manifestSchemaId);
} catch (e) {
  badRestoreDoubleSlashCaught = e.message.includes('double slash');
}
const badRestoreLeadingDotManifest = JSON.parse(JSON.stringify(dupManifest));
badRestoreLeadingDotManifest.artifacts = [dupManifest.artifacts[0]];
badRestoreLeadingDotManifest.update_station_workflow.rollback_steps[0].target = "snapshots/.hidden/backup.db";
let badRestoreLeadingDotCaught = false;
try {
  validatePlatformSemantics(badRestoreLeadingDotManifest, manifestSchemaId);
} catch (e) {
  badRestoreLeadingDotCaught = e.message.includes('leading dot segment');
}
H('12b', badRestoreDoubleSlashCaught && badRestoreLeadingDotCaught, 'strict snapshot restore target path constraints (no //, no leading dot) must be enforced by validatePlatformSemantics');

// 13. in-memory validation: reject offline manifest with alias collision paths (alias collision)
const aliasManifest = {
  ...dupManifest,
  artifacts: [
    {
      name: "image-1",
      path: "images/image-1.tar",
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      size_bytes: 1024
    },
    {
      name: "image-2",
      path: "./images/image-1.tar",
      sha256: "0000000000000000000000000000000000000000000000000000000000000000",
      size_bytes: 2048
    }
  ]
};
try {
  validatePlatformSemantics(aliasManifest, manifestSchemaId);
  fail('alias collision: expected validatePlatformSemantics to throw on aliased paths');
} catch (e) {
  H('13', e.message.includes('duplicate artifact path'), 'alias collision check must catch aliased artifact paths');
}

// 14. in-memory validation: reject offline manifest with trailing slash path
const trailingSlashManifest = {
  ...dupManifest,
  artifacts: [
    {
      name: "image-1",
      path: "images/image-1.tar/",
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      size_bytes: 1024
    }
  ]
};
const trailingValid = ajv.validate(manifestSchemaId, trailingSlashManifest);
H('14', !trailingValid, 'trailing slash path must be rejected by schema');

// ---------------------------------------------------------------------------

// 15. in-memory validation: reject S1 with mediated egress
const profileSchemaId = 'https://contracts.cybrik.example/cybrik.deployment-profile.v1.schema.json';
const s1Profile = JSON.parse(JSON.stringify(readJson(join(PLATFORM_EXAMPLES_DIR, 'onprem-standard-v1.profile.json'))));
s1Profile.isolation_policy.floor = "S1_DYNAMIC_TENANT_WORKLOAD";
s1Profile.isolation_policy.admitted_risk_classes = ["DYNAMIC_TENANT_WORKLOAD", "DETERMINISTIC_SERVICE_CONTAINER"];
s1Profile.isolation_policy.network_egress_isolation = "MEDIATED_EGRESS_BROKER";
const s1Valid = ajv.validate(profileSchemaId, s1Profile);
H('15', !s1Valid && ajv.errors.some(e => e.instancePath === '/isolation_policy/network_egress_isolation' && e.keyword === 'const'), 'S1 with MEDIATED_EGRESS_BROKER must be rejected (requires FAIL_CLOSED_NO_EGRESS)');

// 16. in-memory validation: reject S3 with no egress
const s3Profile = JSON.parse(JSON.stringify(readJson(join(PLATFORM_EXAMPLES_DIR, 'onprem-standard-v1.profile.json'))));
s3Profile.isolation_policy.floor = "S3_HARDWARE_VIRTUALIZED_HYPERVISOR";
s3Profile.isolation_policy.network_egress_isolation = "FAIL_CLOSED_NO_EGRESS";
const s3Valid = ajv.validate(profileSchemaId, s3Profile);
H('16', !s3Valid && ajv.errors.some(e => e.instancePath === '/isolation_policy/network_egress_isolation' && e.keyword === 'const'), 'S3 with FAIL_CLOSED_NO_EGRESS must be rejected (requires MEDIATED_EGRESS_BROKER)');

// 17. in-memory validation: reject platform slot with bare uppercase/tier conformance_profile
const platformContractSchemaId = 'https://contracts.cybrik.example/cybrik.platform-contract.v1.schema.json';
const platformContract = JSON.parse(JSON.stringify(readJson(join(PLATFORM_EXAMPLES_DIR, 'sample-platform-contract.json'))));
platformContract.slots.oci_container_runtime.conformance_profile = "TIER_0";
const platformValid = ajv.validate(platformContractSchemaId, platformContract);
H('17', !platformValid && ajv.errors.length === 1 && ajv.errors[0].instancePath === '/slots/oci_container_runtime/conformance_profile' && ajv.errors[0].keyword === 'pattern', 'Platform contract with bare "TIER_0" conformance_profile must be rejected');

// 21. in-memory validation: reject capability negotiation with unverified evidence binding when active lease granted
const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
const pcnSample = readJson(join(PLATFORM_EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'));
const pcnUnverified = JSON.parse(JSON.stringify(pcnSample));
pcnUnverified.evidence_binding_verified = false;
const pcnUnverifiedValid = ajv.validate(pcnSchemaId, pcnUnverified);
H('21', !pcnUnverifiedValid && ajv.errors.some(e => e.instancePath === '/evidence_binding_verified' && e.keyword === 'const'), 'Capability negotiation with unverified evidence binding when lease granted must be rejected');

// 22. in-memory validation: reject capability negotiation with missing mandatory slots in lease
const pcnMissingMandatory = JSON.parse(JSON.stringify(pcnSample));
pcnMissingMandatory.agreed_capability_lease.mandatory_slots_satisfied = pcnMissingMandatory.agreed_capability_lease.mandatory_slots_satisfied.filter(s => s !== 'oci_container_runtime');
const pcnMissingValid = ajv.validate(pcnSchemaId, pcnMissingMandatory);
H('22', !pcnMissingValid && ajv.errors.some(e => e.keyword === 'contains'), 'Capability negotiation lease missing mandatory oci_container_runtime slot must be rejected via contains');

// 22b. in-memory validation: reject missing core mandatory slot in negotiation_request.requested_slots
const pcnMissingReqSlotSemantic = JSON.parse(JSON.stringify(pcnSample));
pcnMissingReqSlotSemantic.negotiation_request.requested_slots = pcnMissingReqSlotSemantic.negotiation_request.requested_slots.filter(s => s !== 'storage');
try {
  validatePlatformSemantics(pcnMissingReqSlotSemantic, pcnSchemaId);
  fail('missing requested slot: expected validatePlatformSemantics to throw when core mandatory slot is missing from requested_slots');
} catch (e) {
  H('22b', e.message.includes('missing core mandatory slot'), 'negotiation request check must catch missing core mandatory slot');
}

// 23. in-memory validation: reject ACTIVE_DEGRADED when FAIL_CLOSED_STRICT is set
const pcnStrictDegraded = JSON.parse(JSON.stringify(pcnSample));
pcnStrictDegraded.negotiation_request.degradation_policy = "FAIL_CLOSED_STRICT";
pcnStrictDegraded.agreed_capability_lease.lease_status = "ACTIVE_DEGRADED";
const pcnStrictDegradedValid = ajv.validate(pcnSchemaId, pcnStrictDegraded);
H('23', !pcnStrictDegradedValid, 'Capability negotiation with FAIL_CLOSED_STRICT must reject ACTIVE_DEGRADED lease status');

// 24. in-memory validation: reject lease with mismatched target_profile_digest in semantic validation
const pcnBadLeaseDigest = JSON.parse(JSON.stringify(pcnSample));
pcnBadLeaseDigest.agreed_capability_lease.target_profile_digest = "0000000000000000000000000000000000000000000000000000000000000000";
try {
  validatePlatformSemantics(pcnBadLeaseDigest, pcnSchemaId);
  fail('lease digest binding: expected validatePlatformSemantics to throw on mismatched lease digest');
} catch (e) {
  H('24', e.message.includes('does not match actual digest'), 'lease digest binding check must catch mismatched target profile digest on lease');
}

// 25. in-memory validation: reject lease missing advertised evidence for mandatory slot
const pcnMissingEvidence = JSON.parse(JSON.stringify(pcnSample));
pcnMissingEvidence.advertisement_response.advertised_capabilities = pcnMissingEvidence.advertisement_response.advertised_capabilities.filter(c => c.slot_id !== 'storage');
try {
  validatePlatformSemantics(pcnMissingEvidence, pcnSchemaId);
  fail('mandatory slot fulfillment: expected validatePlatformSemantics to throw when mandatory slot is missing from advertised capabilities');
} catch (e) {
  H('25', e.message.includes('mandatory profile slot'), 'mandatory slot fulfillment check must catch missing advertised capability for required slot');
}

// 26_time. in-memory validation: reject capability negotiation with inverted timestamps (valid_until <= issued_at)
const pcnInvertedTime = JSON.parse(JSON.stringify(pcnSample));
pcnInvertedTime.agreed_capability_lease.issued_at = "2026-08-27T14:00:00Z";
pcnInvertedTime.agreed_capability_lease.valid_until = "2026-08-27T13:00:00Z";
try {
  validatePlatformSemantics(pcnInvertedTime, pcnSchemaId);
  fail('inverted timestamps: expected validatePlatformSemantics to throw on valid_until <= issued_at');
} catch (e) {
  H('26', e.message.includes('strictly greater than issued_at_ms'), 'temporal consistency check must catch inverted timestamps');
}

// 27_ttl. in-memory validation: reject capability negotiation with mismatched ttl_seconds
const pcnBadTtl = JSON.parse(JSON.stringify(pcnSample));
pcnBadTtl.agreed_capability_lease.ttl_seconds = 1800; // actual delta is 3600
try {
  validatePlatformSemantics(pcnBadTtl, pcnSchemaId);
  fail('mismatched TTL: expected validatePlatformSemantics to throw when ttl_seconds does not match timestamp delta');
} catch (e) {
  H('27', e.message.includes('does not match timestamp duration'), 'temporal consistency check must catch mismatched ttl_seconds');
}

// 27b_subsecond_ttl. in-memory validation: reject capability negotiation with subsecond timestamp mismatch
const pcnSubsecondTtl = JSON.parse(JSON.stringify(pcnSample));
pcnSubsecondTtl.agreed_capability_lease.issued_at = "2026-08-27T12:00:00.000Z";
pcnSubsecondTtl.agreed_capability_lease.valid_until = "2026-08-27T13:00:00.899Z";
pcnSubsecondTtl.agreed_capability_lease.ttl_seconds = 3600;
try {
  validatePlatformSemantics(pcnSubsecondTtl, pcnSchemaId);
  fail('subsecond TTL mismatch: expected validatePlatformSemantics to throw on non-exact millisecond duration');
} catch (e) {
  H('27b', e.message.includes('does not match timestamp duration'), 'exact millisecond TTL check must catch subsecond duration mismatch');
}

// 28a. in-memory validation: reject AGREED_LEASE_GRANTED paired with ACTIVE_DEGRADED
const pcnIllegalPair1 = JSON.parse(JSON.stringify(pcnSample));
pcnIllegalPair1.negotiation_status = "AGREED_LEASE_GRANTED";
pcnIllegalPair1.agreed_capability_lease.lease_status = "ACTIVE_DEGRADED";
const pcnIllegalPair1Valid = ajv.validate(pcnSchemaId, pcnIllegalPair1);
H('28a', !pcnIllegalPair1Valid, 'Capability negotiation schema must reject AGREED_LEASE_GRANTED with ACTIVE_DEGRADED lease status');

// 28b. in-memory validation: reject DEGRADED_LEASE_GRANTED paired with ACTIVE_OPTIMAL
const pcnIllegalPair2 = JSON.parse(JSON.stringify(pcnSample));
pcnIllegalPair2.negotiation_status = "DEGRADED_LEASE_GRANTED";
pcnIllegalPair2.agreed_capability_lease.lease_status = "ACTIVE_OPTIMAL";
const pcnIllegalPair2Valid = ajv.validate(pcnSchemaId, pcnIllegalPair2);
H('28b', !pcnIllegalPair2Valid, 'Capability negotiation schema must reject DEGRADED_LEASE_GRANTED with ACTIVE_OPTIMAL lease status');

// 28c. in-memory validation: reject hidden degradation in ACTIVE_OPTIMAL lease
const pcnHiddenDegradation = JSON.parse(JSON.stringify(pcnSample));
pcnHiddenDegradation.negotiation_status = "AGREED_LEASE_GRANTED";
pcnHiddenDegradation.agreed_capability_lease.lease_status = "ACTIVE_OPTIMAL";
try {
  validatePlatformSemantics(pcnHiddenDegradation, pcnSchemaId);
  fail('hidden degradation: expected validatePlatformSemantics to throw when ACTIVE_OPTIMAL lease contains degraded capabilities');
} catch (e) {
  H('28c', e.message.includes('ACTIVE_OPTIMAL lease cannot contain degraded capability'), 'degradation coupling check must reject degraded capabilities in ACTIVE_OPTIMAL lease');
}

// 29a. in-memory validation: reject storage capability missing 17-op baseline operations
const pcnStorageMissingOp = JSON.parse(JSON.stringify(pcnSample));
const storeCap = pcnStorageMissingOp.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
storeCap.supported_features = storeCap.supported_features.filter(f => f !== 'PutObjectRetention');
try {
  validatePlatformSemantics(pcnStorageMissingOp, pcnSchemaId);
  fail('storage 17-op baseline: expected validatePlatformSemantics to throw when S3 operation is missing');
} catch (e) {
  H('29a', e.message.includes('missing required S3 operation'), 'storage 17-op baseline check must catch missing operations');
}

// 29b. in-memory validation: reject storage capability missing Object Lock retention evidence
const pcnStorageMissingLockEv = JSON.parse(JSON.stringify(pcnSample));
const storeCap2 = pcnStorageMissingLockEv.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
storeCap2.evidence_references = ["urn:cybrik:evidence:storage:s3-17-ops:v1"];
pcnStorageMissingLockEv.advertisement_response.conformance_evidence = pcnStorageMissingLockEv.advertisement_response.conformance_evidence
  .filter(e => e.test_identifier !== 'urn:cybrik:evidence:storage:object-lock:v1')
  .map(e => ({
    ...e,
    status: 'PASS',
    evidence_pack_digest: 'a105050505050505050505050505050505050505050505050505050505050505'
  }));
try {
  validatePlatformSemantics(pcnStorageMissingLockEv, pcnSchemaId);
  fail('storage Object Lock evidence: expected validatePlatformSemantics to throw when Object Lock evidence is missing');
} catch (e) {
  H('29b', e.message.includes('lacks Object Lock retention evidence'), 'storage Object Lock evidence check must catch missing retention evidence');
}

// 30a. in-memory validation: reject capability negotiation request missing mandatory slots
const pcnMissingReqSlot = JSON.parse(JSON.stringify(pcnSample));
pcnMissingReqSlot.negotiation_request.requested_slots = pcnMissingReqSlot.negotiation_request.requested_slots.filter(s => s !== 'oci_container_runtime');
const pcnMissingReqSlotValid = ajv.validate(pcnSchemaId, pcnMissingReqSlot);
H('30a', !pcnMissingReqSlotValid && ajv.errors.some(e => e.keyword === 'contains'), 'Capability negotiation request missing mandatory slot in requested_slots must be rejected via contains');

// 30b. in-memory validation: reject ACTIVE_OPTIMAL lease containing degraded capability or non-NONE fallback
const pcnOptimalWithDegraded = JSON.parse(JSON.stringify(pcnSample));
pcnOptimalWithDegraded.negotiation_status = "AGREED_LEASE_GRANTED";
pcnOptimalWithDegraded.agreed_capability_lease.lease_status = "ACTIVE_OPTIMAL";
pcnOptimalWithDegraded.agreed_capability_lease.negotiated_optional_capabilities = [
  {
    capability_name: "ai_tensor_acceleration",
    slot_id: "ai_model_runtime",
    disposition: "GRANTED_DEGRADED",
    active_mode: "cpu_quantized_emulation",
    fallback_applied: "CORE_EMULATION_FALLBACK"
  }
];
const pcnOptimalWithDegradedValid = ajv.validate(pcnSchemaId, pcnOptimalWithDegraded);
H('30b', !pcnOptimalWithDegradedValid, 'ACTIVE_OPTIMAL lease containing GRANTED_DEGRADED capability must be rejected');

// 30c. in-memory validation: reject ACTIVE_DEGRADED lease with 0 degraded capabilities
const pcnDegradedNoDegradations = JSON.parse(JSON.stringify(pcnSample));
pcnDegradedNoDegradations.agreed_capability_lease.negotiated_optional_capabilities = [
  {
    capability_name: "ai_tensor_acceleration",
    slot_id: "ai_model_runtime",
    disposition: "GRANTED_FULL",
    active_mode: "gpu_tensor_direct",
    fallback_applied: "NONE"
  }
];
const pcnDegradedNoDegradationsValid = ajv.validate(pcnSchemaId, pcnDegradedNoDegradations);
H('30c', !pcnDegradedNoDegradationsValid && ajv.errors.some(e => e.keyword === 'contains'), 'ACTIVE_DEGRADED lease with 0 degraded capabilities must be rejected via contains');

// 30d. in-memory validation: reject ACTIVE_DEGRADED lease where degraded capability has fallback_applied NONE
const pcnDegradedWithNoneFallback = JSON.parse(JSON.stringify(pcnSample));
pcnDegradedWithNoneFallback.agreed_capability_lease.negotiated_optional_capabilities = [
  {
    capability_name: "ai_tensor_acceleration",
    slot_id: "ai_model_runtime",
    disposition: "GRANTED_DEGRADED",
    active_mode: "cpu_quantized_emulation",
    fallback_applied: "NONE"
  }
];
const pcnDegradedWithNoneFallbackValid = ajv.validate(pcnSchemaId, pcnDegradedWithNoneFallback);
H('30d', !pcnDegradedWithNoneFallbackValid, 'ACTIVE_DEGRADED lease with GRANTED_DEGRADED and fallback_applied NONE must be rejected');

// 30e. in-memory validation: reject capability negotiation with degraded immutable storage
const pcnDegradedStorage = JSON.parse(JSON.stringify(pcnSample));
const storageOptionalCap = pcnDegradedStorage.agreed_capability_lease.negotiated_optional_capabilities.find(c => c.capability_name === 'storage_object_lock' || c.slot_id === 'storage');
if (storageOptionalCap) {
  storageOptionalCap.disposition = "GRANTED_DEGRADED";
  storageOptionalCap.fallback_applied = "FEATURE_DISABLED_GRACEFUL";
}
try {
  validatePlatformSemantics(pcnDegradedStorage, pcnSchemaId);
  fail('immutable storage degradation: expected validatePlatformSemantics to throw DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN when storage_object_lock is GRANTED_DEGRADED');
} catch (e) {
  H('30e', e.message.includes('DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN'), 'storage Object Lock WORM non-degradability check must catch GRANTED_DEGRADED storage capability');
}

// 30f. in-memory validation: permit degraded storage when profile does not require immutable storage (OPEN-5)
const privateCloudPath = join(PLATFORM_EXAMPLES_DIR, 'private-cloud-v1.profile.json');
const privateCloudDigest = createHash('sha256').update(readFileSync(privateCloudPath)).digest('hex');
const pcnDegradedStoragePermitted = JSON.parse(JSON.stringify(pcnSample));
pcnDegradedStoragePermitted.target_profile_id = 'private-cloud-v1';
pcnDegradedStoragePermitted.target_profile_digest = privateCloudDigest;
if (pcnDegradedStoragePermitted.advertisement_response) {
  pcnDegradedStoragePermitted.advertisement_response.target_profile_digest = privateCloudDigest;
}
pcnDegradedStoragePermitted.agreed_capability_lease.target_profile_id = 'private-cloud-v1';
pcnDegradedStoragePermitted.agreed_capability_lease.target_profile_digest = privateCloudDigest;
const storageOptionalPermitted = pcnDegradedStoragePermitted.agreed_capability_lease.negotiated_optional_capabilities.find(c => c.capability_name === 'storage_object_lock' || c.slot_id === 'storage');
if (storageOptionalPermitted) {
  storageOptionalPermitted.disposition = "GRANTED_DEGRADED";
  storageOptionalPermitted.active_mode = "standard_retention_fallback";
  storageOptionalPermitted.fallback_applied = "FEATURE_DISABLED_GRACEFUL";
}
let pcnPermittedNoThrow = false;
try {
  validatePlatformSemantics(pcnDegradedStoragePermitted, pcnSchemaId);
  pcnPermittedNoThrow = true;
} catch (e) {
  pcnPermittedNoThrow = false;
}
H('30f', pcnPermittedNoThrow, 'degraded storage must be permitted when profile does not require immutable storage');

// 30g. in-memory validation: validate immutable_storage_required in deployment profile schema (Finding 1 / OPEN-5)
const sampleProfile = JSON.parse(JSON.stringify(readJson(join(PLATFORM_EXAMPLES_DIR, 'onprem-standard-v1.profile.json'))));
const profileMissingSpec = JSON.parse(JSON.stringify(sampleProfile));
delete profileMissingSpec.slots.storage.specification;
const profileMissingSpecValid = ajv.validate(profileSchemaId, profileMissingSpec);
H('30g-1', !profileMissingSpecValid && ajv.errors.some(e => e.keyword === 'required' && e.params?.missingProperty === 'specification'), 'slots.storage missing specification must be rejected');

const profileMissingImmutable = JSON.parse(JSON.stringify(sampleProfile));
delete profileMissingImmutable.slots.storage.specification.immutable_storage_required;
const profileMissingImmutableValid = ajv.validate(profileSchemaId, profileMissingImmutable);
H('30g-2', !profileMissingImmutableValid && ajv.errors.some(e => e.keyword === 'required' && e.params?.missingProperty === 'immutable_storage_required'), 'slots.storage.specification missing immutable_storage_required must be rejected');

const profileAirgap = readJson(join(PLATFORM_EXAMPLES_DIR, 'onprem-airgap-v1.profile.json'));
const profileHybrid = readJson(join(PLATFORM_EXAMPLES_DIR, 'hybrid-sovereign-v1.profile.json'));
const profilePrivate = readJson(join(PLATFORM_EXAMPLES_DIR, 'private-cloud-v1.profile.json'));
H('30g-3', sampleProfile.slots?.storage?.specification?.immutable_storage_required === true &&
           profileAirgap.slots?.storage?.specification?.immutable_storage_required === true &&
           profileHybrid.slots?.storage?.specification?.immutable_storage_required === true &&
           profilePrivate.slots?.storage?.specification?.immutable_storage_required === false,
  'all 4 deployment profiles must declare explicit immutable_storage_required boolean');

// 30h. in-memory validation: reject duplicate composite key in negotiation_request.requested_optional_capabilities (Finding R16-02 / OPEN-5)
const pcnDupReqKey = JSON.parse(JSON.stringify(pcnSample));
pcnDupReqKey.negotiation_request.requested_optional_capabilities.push({
  capability_name: pcnDupReqKey.negotiation_request.requested_optional_capabilities[0].capability_name,
  slot_id: pcnDupReqKey.negotiation_request.requested_optional_capabilities[0].slot_id,
  required_for_optimal: false,
  preferred_fallback: "FEATURE_DISABLED_GRACEFUL"
});
let pcnDupReqKeyCaught = false;
try {
  validatePlatformSemantics(pcnDupReqKey, pcnSchemaId);
} catch (e) {
  pcnDupReqKeyCaught = e.message.includes('requested_optional_capabilities contains duplicate composite key');
}
H('30h', pcnDupReqKeyCaught, 'duplicate composite key in negotiation_request.requested_optional_capabilities must be rejected');

// 30i. in-memory validation: reject duplicate composite key in agreed_capability_lease.negotiated_optional_capabilities (Finding R16-02 / OPEN-5)
const pcnDupLeaseKey = JSON.parse(JSON.stringify(pcnSample));
pcnDupLeaseKey.agreed_capability_lease.negotiated_optional_capabilities.push({
  capability_name: pcnDupLeaseKey.agreed_capability_lease.negotiated_optional_capabilities[0].capability_name,
  slot_id: pcnDupLeaseKey.agreed_capability_lease.negotiated_optional_capabilities[0].slot_id,
  disposition: "GRANTED_FULL",
  active_mode: "gpu_direct",
  fallback_applied: "NONE"
});
let pcnDupLeaseKeyCaught = false;
try {
  validatePlatformSemantics(pcnDupLeaseKey, pcnSchemaId);
} catch (e) {
  pcnDupLeaseKeyCaught = e.message.includes('negotiated_optional_capabilities contains duplicate composite key');
}
H('30i', pcnDupLeaseKeyCaught, 'duplicate composite key in agreed_capability_lease.negotiated_optional_capabilities must be rejected');



// ---------------------------------------------------------------------------
// S3 compatibility subset in-memory assertions (OPEN-2).
// ---------------------------------------------------------------------------
// 26. S3 closed 17-operation catalog assertions
const CLOSED_17_S3_OPERATIONS = [
  'PutObject', 'GetObject', 'HeadObject', 'DeleteObject', 'DeleteObjects',
  'ListObjectsV2', 'HeadBucket', 'CreateBucket', 'PutObjectRetention',
  'GetObjectRetention', 'PutObjectLegalHold', 'GetObjectLegalHold',
  'CreateMultipartUpload', 'UploadPart', 'CompleteMultipartUpload',
  'AbortMultipartUpload', 'ListParts'
];
const s3OpValidator = ajv.getSchema(S3_OP_DEF_ID);
const s3OpsAllValid = !!s3OpValidator && CLOSED_17_S3_OPERATIONS.every(op => s3OpValidator(op));
const s3BadOpsRejected = !s3OpValidator('PutObjectAclUnsupported') && !s3OpValidator('RestoreObjectTier') && !s3OpValidator('ListBuckets');
H('26', s3OpsAllValid && s3BadOpsRejected, 'S3 closed 17-operation catalog must accept all 17 operations and reject non-S3 operations');

// 27. S3 closed 13-error codes assertions
const CLOSED_13_S3_ERROR_CODES = [
  'BadDigest', 'InvalidDigest', 'NoSuchBucket', 'NoSuchKey', 'NoSuchUpload',
  'ObjectLockConfigurationNotFoundError', 'PreconditionFailed', 'AccessDenied',
  'EntityTooLarge', 'EntityTooSmall', 'InvalidArgument', 'InvalidPart', 'InvalidPartOrder'
];
const sampleS3Profile = readJson(join(STORAGE_EXAMPLES_DIR, 'positive/s3-storage-conformance-profile.json'));
const s3ErrorsAllValid = CLOSED_13_S3_ERROR_CODES.every(errCode => {
  const mutated = { ...sampleS3Profile, required_error_codes: [errCode, ...CLOSED_13_S3_ERROR_CODES.filter(c => c !== errCode)] };
  return ajv.validate(S3_PROFILE_DEF_ID, mutated);
});
const badErrorCodeProfile = { ...sampleS3Profile, required_error_codes: ['NonExistentErrorCode', ...CLOSED_13_S3_ERROR_CODES.slice(1)] };
const s3BadErrorRejected = !ajv.validate(S3_PROFILE_DEF_ID, badErrorCodeProfile) && ajv.errors.length === 1 && ajv.errors[0].keyword === 'enum';
H('27', s3ErrorsAllValid && s3BadErrorRejected, 'S3 closed 13-error taxonomy must validate all 13 error codes and reject unsupported codes');

// 27b. in-memory validation: storage conformance profile missing any of 13 canonical error codes fails validatePlatformSemantics (Finding R16-01 / OPEN-2)
let s3MissingCanonicalCodesCaught = true;
for (const code of CLOSED_13_S3_ERROR_CODES) {
  const missingCodeProfile = {
    ...sampleS3Profile,
    required_error_codes: CLOSED_13_S3_ERROR_CODES.filter(c => c !== code)
  };
  try {
    validatePlatformSemantics(missingCodeProfile, S3_PROFILE_DEF_ID);
    s3MissingCanonicalCodesCaught = false;
  } catch (e) {
    if (!e.message.includes(`storage conformance profile required_error_codes is missing required canonical error code '${code}'`)) {
      s3MissingCanonicalCodesCaught = false;
    }
  }
}
H('27b', s3MissingCanonicalCodesCaught, 'storage conformance profile missing any required canonical error code must fail validatePlatformSemantics');

// 28. S3 retention modes coverage (COMPLIANCE, GOVERNANCE)
const retModeValidator = ajv.getSchema(S3_RETENTION_MODE_DEF_ID);
const retModesValid = retModeValidator('COMPLIANCE') && retModeValidator('GOVERNANCE');
const retModesInvalid = ['STANDARD', 'BYPASS_GOVERNANCE', 'compliance', 'NONE'].every(m => !retModeValidator(m));
H('28', retModesValid && retModesInvalid, 'Object lock retention modes must only accept COMPLIANCE and GOVERNANCE');

// 29. S3 legal hold status coverage (ON, OFF)
const legalHoldValidator = ajv.getSchema(S3_LEGAL_HOLD_DEF_ID);
const legalHoldValid = legalHoldValidator('ON') && legalHoldValidator('OFF');
const legalHoldInvalid = ['ENABLED', 'DISABLED', 'on', 'off', 'TRUE'].every(s => !legalHoldValidator(s));
H('29', legalHoldValid && legalHoldInvalid, 'Legal hold status must only accept ON and OFF');

// 30. S3 path formatting and bucket naming rules
const bucketValidator = ajv.getSchema(S3_BUCKET_NAME_DEF_ID);
const bucketValid = ['my-bucket', 'cybrik-audit-vault', 'telemetry.archive-2026', 'abc', 'a'.repeat(63)].every(b => bucketValidator(b));
const bucketInvalid = ['MyBucket', 'ab', 'a'.repeat(64), '-bucket', 'bucket-', '.bucket', 'bucket.', 'bucket with space', 'bucket/nested'].every(b => !bucketValidator(b));
H('30', bucketValid && bucketInvalid, 'S3 bucket naming rules must enforce 3-63 chars, lowercase, no leading/trailing dot/dash');

// 31. S3 object key normalization with dot-segment rejection
const keyValidator = ajv.getSchema(S3_OBJECT_KEY_DEF_ID);
const keyValid = ['evidence.tar.gz', 'forensics/2026/08/incident-1042-evidence.bundle', 'a/b/c/d/file.json'].every(k => keyValidator(k));
const keyInvalid = ['/leading/slash', 'adjacent//slashes', '', './leading-dot-slash', '../dot-dot', 'key/../dot-dot', 'key/./dot-slash', 'key/trailing-slash/', 'key/.hidden'].every(k => !keyValidator(k));
H('31', keyValid && keyInvalid, 'S3 object key normalization must strictly reject dot-segments, leading/trailing/adjacent slashes');

// 32. S3 URI and path-style URL formatting
const s3UriValidator = ajv.getSchema(S3_URI_DEF_ID);
const pathStyleUrlValidator = ajv.getSchema(S3_PATH_STYLE_URL_DEF_ID);
const s3UriValid = s3UriValidator('s3://cybrik-audit/evidence/bundle.tar.gz') && !s3UriValidator('http://cybrik-audit/evidence/bundle.tar.gz') && !s3UriValidator('s3:///evidence/bundle.tar.gz');
const pathStyleUrlValid = pathStyleUrlValidator('https://storage.internal.cybrik:9000/cybrik-audit/evidence/bundle.tar.gz') && pathStyleUrlValidator('http://127.0.0.1:9000/bucket/key') && !pathStyleUrlValidator('https://storage.internal.cybrik//key');
H('32', s3UriValid && pathStyleUrlValid, 'S3 URI and path-style URL formats must enforce canonical syntax');

// 33. S3 mandatory addressing style and auth mechanism
const badAddressingProfile = { ...sampleS3Profile, addressing_style: 'virtual_host' };
const badAuthProfile = { ...sampleS3Profile, auth_mechanism: 'Bearer' };
const s3AddressingAuthValid = !ajv.validate(S3_PROFILE_DEF_ID, badAddressingProfile) && ajv.errors[0].keyword === 'const' && !ajv.validate(S3_PROFILE_DEF_ID, badAuthProfile) && ajv.errors[0].keyword === 'const';
H('33', s3AddressingAuthValid, 'S3 profile must mandate addressing_style=path_style and auth_mechanism=AWS4-HMAC-SHA256');

// 34. S3 mandatory operations boolean flags
const s3FlagsValid = ['crud', 'multipart_upload', 'presigning', 'sig_v4', 'path_style_access', 'versioning', 'error_mappings'].every(flag => {
  const mutated = { ...sampleS3Profile, mandatory_operations: { ...sampleS3Profile.mandatory_operations, [flag]: false } };
  return !ajv.validate(S3_PROFILE_DEF_ID, mutated) && ajv.errors.length === 1 && ajv.errors[0].keyword === 'const';
});
H('34', s3FlagsValid, 'S3 mandatory operations boolean flags must all be const true');

// 35. S3 mandated root and profile WORM support (Finding 3)
const badObjectLock = { ...sampleS3Profile, object_lock_supported: false };
const singleModeProfile = { ...sampleS3Profile, retention_modes_supported: ['COMPLIANCE'] };
const badLegalHoldProfile = { ...sampleS3Profile, legal_hold_supported: false };
const s3WormValid = !ajv.validate(S3_PROFILE_DEF_ID, badObjectLock) && ajv.errors[0].keyword === 'const' &&
                    !ajv.validate(S3_PROFILE_DEF_ID, singleModeProfile) && ajv.errors[0].keyword === 'minItems' &&
                    !ajv.validate(S3_PROFILE_DEF_ID, badLegalHoldProfile) && ajv.errors[0].keyword === 'const';
H('35', s3WormValid, 'S3 schema must mandate root/profile WORM support (object_lock_supported: true, retention_modes_supported: minItems 2, legal_hold_supported: true)');

// 36. S3 version_id on retention evidence (Finding 3)
const sampleRetentionRecord = readJson(join(STORAGE_EXAMPLES_DIR, 'positive/s3-object-retention-compliance.json'));
const missingVerRetention = { ...sampleRetentionRecord };
delete missingVerRetention.version_id;
const badVerRetention = { ...sampleRetentionRecord, version_id: 'bad version with spaces' };
const s3VersionIdValid = ajv.validate(S3_RETENTION_DEF_ID, sampleRetentionRecord) &&
                         ajv.validate(S3_EVIDENCE_DEF_ID, sampleRetentionRecord) &&
                         !ajv.validate(S3_RETENTION_DEF_ID, missingVerRetention) && ajv.errors.some(e => e.keyword === 'required' && e.params?.missingProperty === 'version_id') &&
                         !ajv.validate(S3_RETENTION_DEF_ID, badVerRetention) && ajv.errors.some(e => e.instancePath === '/version_id');
H('36', s3VersionIdValid, 'S3 retention compliance and storage conformance evidence must require version_id with ^[a-zA-Z0-9._-]+$');

// 37. S3 BadDigest and InvalidDigest strict error dispatch verification (Finding 5 / INV-S3-05)
const mismatchedFixture = readJson(join(STORAGE_EXAMPLES_DIR, 'negative/invalid-s3-dispatch-mismatched-content-md5.json'));
const malformedFixture = readJson(join(STORAGE_EXAMPLES_DIR, 'negative/invalid-s3-dispatch-malformed-content-md5-header.json'));

const realPayloadBytes = Buffer.from('CYBRIK_IMMUTABLE_AUDIT_LOG_BUNDLE_PAYLOAD_2026_TEST');
const realPayloadMd5 = createHash('md5').update(realPayloadBytes).digest('base64');
const realSha256 = createHash('sha256').update(realPayloadBytes).digest('hex');
const mismatchedMd5 = '1B2M2Y8AsgTpgAmY7PhCfg=='; // Valid base64, does not match realPayloadBytes
const malformedMd5 = 'invalid-base64-header-!@#$%';

const matchedDispatch = dispatchS3PutObject({ payloadBytes: realPayloadBytes, contentMd5Header: realPayloadMd5, 'x-amz-content-sha256': realSha256 });
const mismatchDispatch = dispatchS3PutObject({ payloadBytes: realPayloadBytes, contentMd5Header: mismatchedMd5, 'x-amz-content-sha256': realSha256 });
const malformedDispatch = dispatchS3PutObject({ payloadBytes: realPayloadBytes, contentMd5Header: malformedMd5, 'x-amz-content-sha256': realSha256 });

const badDigestResult = verifyDigestErrorDispatch(realPayloadBytes, mismatchedMd5);
const invalidDigestResult = verifyMalformedHeaderDispatch(realPayloadBytes, malformedMd5);

let s3DispatchInvariantsValid = true;
try {
  if (matchedDispatch.http_status !== 200 || matchedDispatch.error_code !== null) s3DispatchInvariantsValid = false;
  if (mismatchDispatch.http_status !== 400 || mismatchDispatch.error_code !== 'BadDigest' || mismatchDispatch.reason !== 'PAYLOAD_DIGEST_MISMATCH') s3DispatchInvariantsValid = false;
  if (malformedDispatch.http_status !== 400 || malformedDispatch.error_code !== 'InvalidDigest' || malformedDispatch.reason !== 'MALFORMED_HEADER_SYNTAX') s3DispatchInvariantsValid = false;

  if (badDigestResult.status !== 400 || badDigestResult.code !== 'BadDigest') s3DispatchInvariantsValid = false;
  if (invalidDigestResult.status !== 400 || invalidDigestResult.code !== 'InvalidDigest') s3DispatchInvariantsValid = false;

  // In-memory negative assertions: returning InvalidArgument or AccessDenied throws
  let threwBad1 = false, threwBad2 = false, threwInv1 = false, threwInv2 = false;
  try { verifyDigestErrorDispatch({ status: 400, code: 'InvalidArgument' }); } catch { threwBad1 = true; }
  try { verifyDigestErrorDispatch({ status: 403, code: 'AccessDenied' }); } catch { threwBad2 = true; }
  try { verifyMalformedHeaderDispatch({ header: 'bad', status: 400, code: 'InvalidArgument' }); } catch { threwInv1 = true; }
  try { verifyMalformedHeaderDispatch({ header: 'bad', status: 403, code: 'AccessDenied' }); } catch { threwInv2 = true; }

  if (!threwBad1 || !threwBad2 || !threwInv1 || !threwInv2) {
    s3DispatchInvariantsValid = false;
  }
} catch {
  s3DispatchInvariantsValid = false;
}
H('37', s3DispatchInvariantsValid, 'S3 strict error dispatch must map payload digest mismatch exclusively to BadDigest (400) and malformed header to InvalidDigest (400), strictly rejecting InvalidArgument and AccessDenied');

// 37b. S3 PutObject x-amz-content-sha256 header validation (OPEN-2 Finding 1)
const mismatchSha256 = '0000000000000000000000000000000000000000000000000000000000000000';
const malformedSha256 = 'not-a-valid-64-hex-sha256!';
const missingShaRes = dispatchS3PutObject({ payloadBytes: realPayloadBytes });
const matchedShaRes = dispatchS3PutObject({ payloadBytes: realPayloadBytes, 'x-amz-content-sha256': realSha256 });
const unsignedShaRes = dispatchS3PutObject({ payloadBytes: realPayloadBytes, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD' });
const streamingShaRes = dispatchS3PutObject({ payloadBytes: realPayloadBytes, 'x-amz-content-sha256': 'STREAMING-AWS4-HMAC-SHA256-PAYLOAD' });
const mismatchShaRes = dispatchS3PutObject({ payloadBytes: realPayloadBytes, 'x-amz-content-sha256': mismatchSha256 });
const malformedShaRes = dispatchS3PutObject({ payloadBytes: realPayloadBytes, 'x-amz-content-sha256': malformedSha256 });
const s3ShaValid = missingShaRes.http_status === 400 &&
                   missingShaRes.error_code === 'InvalidDigest' &&
                   missingShaRes.reason === 'MissingXAmzContentSHA256' &&
                   matchedShaRes.http_status === 200 &&
                   unsignedShaRes.http_status === 200 &&
                   streamingShaRes.http_status === 400 &&
                   streamingShaRes.error_code === 'InvalidDigest' &&
                   (streamingShaRes.reason === 'STREAMING_PAYLOAD_UNSUPPORTED' || streamingShaRes.reason === 'MALFORMED_HEADER_SYNTAX') &&
                   mismatchShaRes.http_status === 400 &&
                   mismatchShaRes.error_code === 'BadDigest' &&
                   (mismatchShaRes.reason === 'PAYLOAD_SHA256_MISMATCH' || mismatchShaRes.reason === 'XAmzContentSHA256Mismatch') &&
                   malformedShaRes.http_status === 400 &&
                   malformedShaRes.error_code === 'InvalidDigest' &&
                   (malformedShaRes.reason === 'MALFORMED_SHA256_HEADER' || malformedShaRes.reason === 'MALFORMED_HEADER_SYNTAX');
H('37b', s3ShaValid, 'dispatchS3PutObject must validate x-amz-content-sha256 header, allowing UNSIGNED-PAYLOAD and rejecting STREAMING-AWS4-HMAC-SHA256-PAYLOAD as InvalidDigest, returning BadDigest on payload mismatch and InvalidDigest on malformed header');

// 37c. S3 CompleteMultipartUpload dispatch validation (OPEN-2 Finding 3)
const completeManifest = {
  parts: [
    { part_number: 1, etag: '"etag-1"', size_bytes: 5242880 },
    { part_number: 2, etag: '"etag-2"', size_bytes: 5242880 }
  ]
};
const storedMapOk = new Map([
  [1, { etag: '"etag-1"' }],
  [2, { etag: '"etag-2"' }]
]);
const storedMapMissing = new Map([
  [1, { etag: '"etag-1"' }]
]);
const storedMapBadEtag = new Map([
  [1, { etag: '"etag-1"' }],
  [2, { etag: '"etag-bad"' }]
]);
const completeOk = dispatchS3CompleteMultipartUpload(completeManifest, storedMapOk);
const completeMissing = dispatchS3CompleteMultipartUpload(completeManifest, storedMapMissing);
const completeBadEtag = dispatchS3CompleteMultipartUpload(completeManifest, storedMapBadEtag);
const s3CompleteValid = completeOk.http_status === 200 &&
                        completeMissing.http_status === 400 &&
                        completeMissing.error_code === 'InvalidPart' &&
                        (completeMissing.reason === 'MissingStoredPartETag' || completeMissing.reason === 'MISSING_PART' || completeMissing.reason === 'PART_NOT_FOUND' || completeMissing.reason === 'PartNotFound') &&
                        completeBadEtag.http_status === 400 &&
                        completeBadEtag.error_code === 'InvalidPart' &&
                        (completeBadEtag.reason === 'ETagMismatch' || completeBadEtag.reason === 'PART_ETAG_MISMATCH' || completeBadEtag.reason === 'ETAG_MISMATCH');
H('37c', s3CompleteValid, 'dispatchS3CompleteMultipartUpload must validate stored parts against manifest parts and return InvalidPart with MissingStoredPartETag/MISSING_PART/PART_NOT_FOUND or ETagMismatch/PART_ETAG_MISMATCH');

// 26. Lexical I-JSON validation probe for offline manifest (RFC 7493 / JCS Invariants)
const validManifestBuf = readFileSync(join(PLATFORM_EXAMPLES_DIR, 'sample-offline-bundle-manifest.json'));
const validManifestRaw = validManifestBuf.toString('utf8');
try {
  validateIJson(validManifestBuf, 'sample-offline-bundle-manifest.json');
  H('26a', true, 'valid offline manifest passes lexical I-JSON validation');
} catch (e) {
  H('26a', false, `valid offline manifest failed I-JSON: ${e.message}`);
}

// 26b. Lexical I-JSON rejects duplicate keys in manifest JSON
const dupKeyRaw = validManifestRaw.replace('"manifest_sequence": 1,', '"manifest_sequence": 1,\n  "manifest_sequence": 2,');
try {
  validateIJson(dupKeyRaw, 'duplicate-key-manifest');
  H('26b', false, 'duplicate key in manifest must be rejected by lexical I-JSON validator');
} catch (e) {
  H('26b', e.message.includes('duplicate object key'), 'lexical I-JSON validator must reject duplicate object keys');
}

// 26c. Lexical I-JSON rejects numbers outside IEEE-754 safe integer range [-(2^53 - 1), 2^53 - 1]
const outOfRangeRaw = validManifestRaw.replace('"manifest_sequence": 1,', '"manifest_sequence": 9007199254740992,');
try {
  validateIJson(outOfRangeRaw, 'out-of-range-manifest');
  H('26c', false, 'out-of-range integer in manifest must be rejected by lexical I-JSON validator');
} catch (e) {
  H('26c', e.message.includes('exceeds IEEE-754 safe integer range'), 'lexical I-JSON validator must reject integers outside IEEE-754 safe integer range');
}

// 26d. Lexical I-JSON rejects floating-point / scientific notation numbers
const floatNumRaw = validManifestRaw.replace('"manifest_sequence": 1,', '"manifest_sequence": 1.5,');
try {
  validateIJson(floatNumRaw, 'float-manifest');
  H('26d', false, 'floating-point number in manifest must be rejected by lexical I-JSON validator');
} catch (e) {
  H('26d', e.message.includes('floating-point or scientific notation'), 'lexical I-JSON validator must reject floating-point numbers');
}

// 26e. Lexical I-JSON rejects raw buffers with invalid UTF-8 bytes
const invalidUtf8Buffer = Buffer.from([0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0xff, 0x28, 0x22, 0x7d]);
try {
  validateIJson(invalidUtf8Buffer, 'invalid-utf8-manifest');
  H('26e', false, 'raw buffer with invalid UTF-8 bytes must be rejected with fatal decoding error');
} catch (e) {
  H('26e', e.message.includes('malformed UTF-8') || e.message.includes('fatal I-JSON validation error'), 'lexical I-JSON validator must reject raw buffers with invalid UTF-8 bytes with a fatal UTF-8 decoding error');
}

// 26f. Lexical I-JSON rejects escaped lone surrogates
const loneSurrogateRaw = validManifestRaw.replace('"release_tag": "v1.2.3",', '"release_tag": "v1.2.3\\ud800",');
try {
  validateIJson(loneSurrogateRaw, 'lone-surrogate-manifest');
  H('26f', false, 'manifest with escaped lone surrogate must be rejected by lexical I-JSON validator');
} catch (e) {
  H('26f', e.message.includes('escaped lone surrogate code point prohibited'), 'lexical I-JSON validator must reject escaped lone surrogate code points');
}
export function validateOpenItemEffectMatrix(proposalMarkdown) {
  const lines = proposalMarkdown.split('\n');
  const tableStartIndex = lines.findIndex(l => l.includes('## 10. Required Open-Item Effect Matrix'));
  if (tableStartIndex === -1) throw new Error('Missing section: ## 10. Required Open-Item Effect Matrix');

  const nextSectionIndex = lines.findIndex((l, i) => i > tableStartIndex && l.startsWith('## '));
  const sectionEndIndex = nextSectionIndex !== -1 ? nextSectionIndex : lines.length;

  const headerIndex = lines.findIndex((l, i) => i > tableStartIndex && i < sectionEndIndex && l.trim().startsWith('| OPEN ID |'));
  if (headerIndex === -1) throw new Error('Missing table header for Open-Item Effect Matrix');

  const rows = [];
  let tableEnded = false;

  for (let i = headerIndex + 2; i < sectionEndIndex; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (!line.startsWith('|')) {
      tableEnded = true;
      continue;
    }

    if (tableEnded && line.startsWith('|')) {
      throw new Error('Governance guard failed: Multiple tables or trailing table rows found in Section 10');
    }

    const parts = line.split('|').map(s => s.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
    if (parts.length !== 4) {
      throw new Error(`Governance guard failed: Matrix row must have exactly 4 columns, found ${parts.length}`);
    }
    rows.push({
      id: parts[0],
      title: parts[1],
      status: parts[2],
      effect: parts[3]
    });
  }

  if (rows.length !== 11) {
    throw new Error(`Governance guard failed: Matrix must have exactly 11 rows, found ${rows.length}`);
  }

  const expectedMatrix = [
    { id: 'OPEN-1', title: '`OFFLINE_INSTALL_UPDATE_CONTRACT`', status: 'OPEN', effect: 'OPEN, PARTIALLY_UNBLOCKED' },
    { id: 'OPEN-2', title: '`S3_COMPATIBILITY_MINIMUM_CONTRACT`', status: 'OPEN', effect: 'OPEN, PARTIALLY_UNBLOCKED' },
    { id: 'OPEN-3', title: '`AI_DNS_TOCTOU_EGRESS_GUARD`', status: 'OPEN', effect: 'OPEN, UNAFFECTED' },
    { id: 'OPEN-4', title: '`CANONICAL_T0_T1_T2_SEMANTICS`', status: 'RESOLVED', effect: 'RESOLVED' },
    { id: 'OPEN-5', title: '`OPTIONAL_PROVIDER_CAPABILITY_NEGOTIATION`', status: 'OPEN', effect: 'OPEN, PARTIALLY_UNBLOCKED' },
    { id: 'OPEN-6', title: '`VIRTUALIZATION_SUBSTRATE_SELECTION`', status: 'OPEN', effect: 'OPEN, REQUIRES_SEPARATE_FOUNDER_DECISION' },
    { id: 'OPEN-7', title: '`KUBERNETES_DISTRIBUTION_SELECTION`', status: 'OPEN', effect: 'OPEN, REQUIRES_SEPARATE_FOUNDER_DECISION' },
    { id: 'OPEN-8', title: '`PROVIDER_SELECTION_AUTHORITY_MODEL`', status: 'OPEN', effect: 'OPEN, REQUIRES_SEPARATE_FOUNDER_DECISION' },
    { id: 'OPEN-9', title: 'Legal interpretation of deployment location and cross-domain obligations', status: 'OPEN', effect: 'OPEN, REQUIRES_SEPARATE_LEGAL_TRACK' },
    { id: 'OPEN-10', title: 'Platform Contract slot semantics (all 13 slots, §5.2)', status: 'RESOLVED', effect: 'RESOLVED' },
    { id: 'OPEN-11', title: '`PRODUCT_CORE_MODULE_VS_IMPLEMENTATION_ADAPTER_BOUNDARY`', status: 'OPEN', effect: 'OPEN, PARTIALLY_UNBLOCKED / PER_MODULE_CLASSIFICATION_REMAINS_OPEN' }
  ];

  const seenIds = new Set();
  for (let i = 0; i < expectedMatrix.length; i++) {
    const row = rows[i];
    const expected = expectedMatrix[i];

    if (!row) throw new Error(`Governance guard failed: Missing row ${i + 1}`);
    if (seenIds.has(row.id)) throw new Error(`Governance guard failed: Duplicate ID ${row.id}`);
    seenIds.add(row.id);

    if (row.id !== expected.id) {
      throw new Error(`Governance guard failed: Expected ID ${expected.id} at row ${i + 1}, found ${row.id}`);
    }
    if (row.title !== expected.title) {
      throw new Error(`Governance guard failed: Swapped or incorrect title for ${row.id}: ${row.title}`);
    }
    if (row.status !== expected.status) {
      throw new Error(`Governance guard failed: Unauthorized status for ${row.id}: ${row.status}`);
    }
    if (row.effect !== expected.effect) {
      throw new Error(`Governance guard failed: Unauthorized effect for ${row.id}: ${row.effect}`);
    }
  }
}

// 19. Governance guard: Platform contract OPEN items tracking
try {
  const validBaseTable = `## 10. Required Open-Item Effect Matrix

| OPEN ID | Verbatim ADR-0015 Title | Current Status / Semantic Meaning | Effect of Platform Contract Proposal |
|---|---|---|---|
| OPEN-1 | \`OFFLINE_INSTALL_UPDATE_CONTRACT\` | OPEN | OPEN, PARTIALLY_UNBLOCKED |
| OPEN-2 | \`S3_COMPATIBILITY_MINIMUM_CONTRACT\` | OPEN | OPEN, PARTIALLY_UNBLOCKED |
| OPEN-3 | \`AI_DNS_TOCTOU_EGRESS_GUARD\` | OPEN | OPEN, UNAFFECTED |
| OPEN-4 | \`CANONICAL_T0_T1_T2_SEMANTICS\` | RESOLVED | RESOLVED |
| OPEN-5 | \`OPTIONAL_PROVIDER_CAPABILITY_NEGOTIATION\` | OPEN | OPEN, PARTIALLY_UNBLOCKED |
| OPEN-6 | \`VIRTUALIZATION_SUBSTRATE_SELECTION\` | OPEN | OPEN, REQUIRES_SEPARATE_FOUNDER_DECISION |
| OPEN-7 | \`KUBERNETES_DISTRIBUTION_SELECTION\` | OPEN | OPEN, REQUIRES_SEPARATE_FOUNDER_DECISION |
| OPEN-8 | \`PROVIDER_SELECTION_AUTHORITY_MODEL\` | OPEN | OPEN, REQUIRES_SEPARATE_FOUNDER_DECISION |
| OPEN-9 | Legal interpretation of deployment location and cross-domain obligations | OPEN | OPEN, REQUIRES_SEPARATE_LEGAL_TRACK |
| OPEN-10 | Platform Contract slot semantics (all 13 slots, §5.2) | RESOLVED | RESOLVED |
| OPEN-11 | \`PRODUCT_CORE_MODULE_VS_IMPLEMENTATION_ADAPTER_BOUNDARY\` | OPEN | OPEN, PARTIALLY_UNBLOCKED / PER_MODULE_CLASSIFICATION_REMAINS_OPEN |

## 11. Next Action Sequence
`;

  const expectThrow = (md) => {
    try {
      validateOpenItemEffectMatrix(md);
      return false;
    } catch (e) {
      return e.message.includes('Governance guard failed');
    }
  };

  H('19a', expectThrow(validBaseTable.replace('\`VIRTUALIZATION_SUBSTRATE_SELECTION\`', '\`WRONG_TITLE\`')), 'Matrix probe: swapped title must fail');
  H('19b', expectThrow(validBaseTable.replace('| OPEN-2 |', '| OPEN-1 |')), 'Matrix probe: duplicate ID must fail');
  H('19c', expectThrow(validBaseTable.replace('OPEN, UNAFFECTED', 'RESOLVED')), 'Matrix probe: unauthorized effect must fail');
  H('19d', expectThrow(validBaseTable.replace('| OPEN-3 |', '| OPEN-3 | EXTRA |')), 'Matrix probe: extra column must fail');
  H('19e', expectThrow(validBaseTable.replace('| OPEN-11 | \`PRODUCT_CORE_MODULE_VS_IMPLEMENTATION_ADAPTER_BOUNDARY\` | OPEN | OPEN, PARTIALLY_UNBLOCKED / PER_MODULE_CLASSIFICATION_REMAINS_OPEN |\n', '')), 'Matrix probe: row count mismatch must fail');

  const proposalPath = join(CONTRACTS, 'platform/CYBRIK-PLATFORM-CONTRACT-V1-PROPOSAL.md');
  const proposalContent = readFileSync(proposalPath, 'utf8');
  validateOpenItemEffectMatrix(proposalContent);
} catch (e) {
  fail(e.message);
}

// 20. Governance guard: OPEN-11 Product Module Sovereignty Classification Map & Ledger
try {
  const mapPath = join(ROOT, 'docs/architecture/PRODUCT-MODULE-SOVEREIGNTY-CLASSIFICATION-MAP.md');
  const ledgerPath = join(ROOT, 'docs/architecture/PRODUCT-MODULE-CLASSIFICATION-LEDGER.json');
  if (!existsSync(mapPath) || !existsSync(ledgerPath)) {
    throw new Error('OPEN-11 map or ledger artifact missing');
  }

  const mapContent = readFileSync(mapPath, 'utf8');
  const ledgerRaw = readFileSync(ledgerPath, 'utf8');
  const ledgerDigest = createHash('sha256').update(ledgerRaw).digest('hex');
  if (ledgerDigest !== 'b428c73895baad718c166bf90f9f8a676fb688c21eb012bf280ce1dad4231831') {
    throw new Error(`Ledger digest mismatch: ${ledgerDigest}`);
  }

  const ledger = JSON.parse(ledgerRaw);
  const repoKeys = Object.keys(ledger).sort();
  if (repoKeys.length !== 3 || repoKeys[0] !== 'cybrik-cyber-ai-platform' || repoKeys[1] !== 'cybrik-security-tool-fabric' || repoKeys[2] !== 'cybrik-soc-command-center') {
    throw new Error('Exact 3 closed top-level repositories expected');
  }

  const validClassifications = new Set([
    'PRODUCT_CORE',
    'PRODUCT_IMPLEMENTATION_ADAPTER',
    'PROVIDER_ADAPTER',
    'SUPPORTING_TOOLING_OR_TEST',
    'DEPLOYMENT_PROFILE_OR_CONFIG',
    'GOVERNANCE_OR_DOCUMENTATION',
  ]);
  const validStatuses = new Set(['IMPLEMENTED', 'SCAFFOLD', 'PLANNED']);

  const lines = mapContent.split('\n');
  const sections = { '2.1': 0, '2.2': 0, '2.3': 0, '2.4': 0 };
  let currentSec = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('### 2.1')) currentSec = '2.1';
    else if (line.startsWith('### 2.2')) currentSec = '2.2';
    else if (line.startsWith('### 2.3')) currentSec = '2.3';
    else if (line.startsWith('### 2.4')) currentSec = '2.4';
    else if (line.startsWith('## 3.')) currentSec = null;

    if (!currentSec || !line.startsWith('|') || line.startsWith('|---') || line.includes('Path / Subsystem')) continue;

    if (!line.endsWith('|')) throw new Error(`Line ${i + 1} must end with |`);
    const parts = line.split('|').map(s => s.trim());
    if (parts[0] !== '' || parts[parts.length - 1] !== '' || parts.length !== 6) {
      throw new Error(`OPEN-11 map line ${i + 1} must have exactly 4 columns`);
    }
    const [, rawPath, rawClass, rawStatus, notes] = parts;
    const classification = rawClass.replace(/^`|`$/g, '');
    const status = rawStatus.replace(/^`|`$/g, '');
    if (!rawPath || rawPath.trim().length === 0) throw new Error(`OPEN-11 map line ${i + 1} empty path`);
    if (!validClassifications.has(classification)) throw new Error(`Invalid classification: ${classification}`);
    if (!validStatuses.has(status)) throw new Error(`Invalid status: ${status}`);
    if (!notes || notes.trim().length === 0) throw new Error(`OPEN-11 map line ${i + 1} empty notes`);
    sections[currentSec]++;
  }

  if (sections['2.1'] !== 28 || sections['2.2'] !== 14 || sections['2.3'] !== 73 || sections['2.4'] !== 2) {
    throw new Error(`Section row counts mismatch: ${JSON.stringify(sections)}`);
  }

  if (ledger['cybrik-cyber-ai-platform']?.commit !== 'f0bf4c630d8e93a0531d16b4522ce0425996a624' ||
      ledger['cybrik-security-tool-fabric']?.commit !== '1a419014ebb432eb56ac35242e0a193fe65a62c6' ||
      ledger['cybrik-soc-command-center']?.commit !== '695aed8e0e12c9d0e11de5f474e3384d1a4b490f') {
    throw new Error('Ledger commit SHA bindings mismatch pinned RC1 commits');
  }

  const aiFiles = Object.keys(ledger['cybrik-cyber-ai-platform']?.files || {});
  const fabricFiles = Object.keys(ledger['cybrik-security-tool-fabric']?.files || {});
  const socFiles = Object.keys(ledger['cybrik-soc-command-center']?.files || {});

  if (aiFiles.length !== 221 || fabricFiles.length !== 132 || socFiles.length !== 1297) {
    throw new Error(`Ledger counts mismatch: AI=${aiFiles.length}, Fabric=${fabricFiles.length}, SOC=${socFiles.length}`);
  }
  if (aiFiles.length + fabricFiles.length + socFiles.length !== 1650) {
    throw new Error('Total ledger file count mismatch: expected 1650');
  }

  // Semantic sentinel checks
  if (ledger['cybrik-soc-command-center'].files['START-CYBRIK.command']?.classification !== 'DEPLOYMENT_PROFILE_OR_CONFIG' ||
      ledger['cybrik-soc-command-center'].files['Makefile']?.classification !== 'SUPPORTING_TOOLING_OR_TEST' ||
      ledger['cybrik-soc-command-center'].files['services/api/.coverage']?.classification !== 'SUPPORTING_TOOLING_OR_TEST' ||
      ledger['cybrik-soc-command-center'].files['services/api/dump.rdb']?.classification !== 'SUPPORTING_TOOLING_OR_TEST' ||
      ledger['cybrik-soc-command-center'].files['.gitleaks.toml']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-soc-command-center'].files['.gitleaksignore']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-soc-command-center'].files['apps/soc-portal/playwright.config.ts']?.classification !== 'SUPPORTING_TOOLING_OR_TEST' ||
      ledger['cybrik-soc-command-center'].files['apps/soc-portal/app/layout.tsx']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/platform/database.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/platform/errors.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['packages/api-contracts/openapi/generic-webhook.v0.yaml']?.classification !== 'PRODUCT_CORE' ||
      ledger['cybrik-soc-command-center'].files['packages/design-system/tokens/tokens.css']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['ops/backup/cybrik_backup/backup.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['ops/backup/cybrik_backup/__main__.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/content/sigma/collection_archive_staging.yml']?.classification !== 'PRODUCT_CORE' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/alert/__init__.py']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/alert/context/wire.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/alert/context/models.py']?.classification !== 'PRODUCT_CORE' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/datalake/lifecycle.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/forensics/search.py']?.classification !== 'PRODUCT_CORE' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/copilot/gateway.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/ingest/ecs.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/ingest/ocsf.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/platform/svc_delegation/algorithms.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/platform/svc_delegation/signer.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/platform/svc_delegation/models.py']?.classification !== 'PRODUCT_CORE' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/platform/svc_delegation/errors.py']?.classification !== 'PRODUCT_CORE' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/soar/connectors/__init__.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/soar/library.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/ioc/taxii.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      !ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/ioc/taxii.py']?.notes?.includes('TaxiiClient') ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/hunt/executions.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/vulnerability/service.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/vulnerability/parsers/common.py']?.classification !== 'PRODUCT_CORE' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/vulnerability/parsers/greenbone.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/vulnerability/parsers/__init__.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/pyproject.toml']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-cyber-ai-platform'].files['packages/ai-core/src/cybrik_ai_core/__init__.py']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-cyber-ai-platform'].files['packages/ai-core/src/cybrik_ai_core/orchestration/checkpoints.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-cyber-ai-platform'].files['packages/ai-core/src/cybrik_ai_core/orchestration/memory.py']?.classification !== 'SUPPORTING_TOOLING_OR_TEST' ||
      ledger['cybrik-cyber-ai-platform'].files['tests/README.md']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-cyber-ai-platform'].files['services/ai-api/src/cybrik_ai_api/transport_security.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-cyber-ai-platform'].files['services/ai-worker/src/cybrik_ai_worker/__init__.py']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-cyber-ai-platform'].files['services/ai-worker/src/cybrik_ai_worker/__init__.py']?.status !== 'SCAFFOLD' ||
      ledger['cybrik-cyber-ai-platform'].files['services/ai-worker/pyproject.toml']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-security-tool-fabric'].files['src/executor/cmd/executor/main.go']?.status !== 'SCAFFOLD' ||
      ledger['cybrik-security-tool-fabric'].files['tests/README.md']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-security-tool-fabric'].files['tests/conformance/README.md']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-security-tool-fabric'].files['tests/control-plane/README.md']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-security-tool-fabric'].files['tests/executor/README.md']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-security-tool-fabric'].files['src/control-plane/cybrik_fabric_control/__init__.py']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-security-tool-fabric'].files['src/control-plane/cybrik_fabric_control/contracts/__init__.py']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-security-tool-fabric'].files['src/control-plane/cybrik_fabric_control/invocation/ports.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-security-tool-fabric'].files['src/control-plane/cybrik_fabric_control/py.typed']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-security-tool-fabric'].files['src/executor/internal/version/version.go']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-security-tool-fabric'].files['src/executor/internal/tier/tier.go']?.classification !== 'PRODUCT_CORE') {
    throw new Error('Ledger semantic sentinel checks failed');
  }

  // Regression probes for Round 22 & Round 23 paths in map selectors
  if (!mapContent.includes('tests/ (excluding README.md), .github/') ||
      !mapContent.includes('tests/ (excluding **/README.md), contracts-vendor/fixtures/') ||
      !mapContent.includes('contracts-vendor/README.md') ||
      !mapContent.includes('contracts-vendor/contracts.lock.json') ||
      !mapContent.includes('contracts-vendor/compatibility/*.manifest.json') ||
      !mapContent.includes('src/control-plane/Dockerfile') ||
      !mapContent.includes('docker/.env.example') ||
      !mapContent.includes('__main__.py') ||
      !mapContent.includes('services/api/pyproject.toml') ||
      !mapContent.includes('TaxiiClient')) {
    throw new Error('Map selector regression probes failed');
  }

  for (const [repo, data] of Object.entries(ledger)) {
    for (const [filePath, entry] of Object.entries(data.files)) {
      if (!filePath || filePath.trim().length === 0) throw new Error(`${repo} empty file path`);
      if (!validClassifications.has(entry.classification)) throw new Error(`${repo}:${filePath} invalid classification ${entry.classification}`);
      if (!validStatuses.has(entry.status)) throw new Error(`${repo}:${filePath} invalid status ${entry.status}`);
      if (!entry.notes || entry.notes.trim().length === 0) throw new Error(`${repo}:${filePath} empty notes`);
    }
  }

  // Exact-once selector-to-ledger reconciliation proving 0 orphans, 0 overlaps, matching classification & status
  const repoRowMap = {
    'cybrik-cyber-ai-platform': [],
    'cybrik-security-tool-fabric': [],
    'cybrik-soc-command-center': []
  };
  let currentActiveRepo = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('### 2.1')) currentActiveRepo = 'cybrik-cyber-ai-platform';
    else if (line.startsWith('### 2.2')) currentActiveRepo = 'cybrik-security-tool-fabric';
    else if (line.startsWith('### 2.3')) currentActiveRepo = 'cybrik-soc-command-center';
    else if (line.startsWith('### 2.4') || line.startsWith('## 3.')) currentActiveRepo = null;
    if (!currentActiveRepo || !line.startsWith('|') || line.startsWith('|---') || line.includes('Path / Subsystem')) continue;
    const parts = line.split('|').map(s => s.trim());
    const [, rawPath, rawClass, rawStatus] = parts;
    repoRowMap[currentActiveRepo].push({
      selector: rawPath.replace(/^`|`$/g, ''),
      classification: rawClass.replace(/^`|`$/g, ''),
      status: rawStatus.replace(/^`|`$/g, ''),
      lineNum: i + 1
    });
  }

  function createMatcher(selector, repo) {
    if (repo === 'cybrik-cyber-ai-platform') {
      if (selector === 'packages/ai-core/src/cybrik_ai_core/authority.py') return f => f === 'packages/ai-core/src/cybrik_ai_core/authority.py';
      if (selector === 'packages/ai-core/src/cybrik_ai_core/marking.py') return f => f === 'packages/ai-core/src/cybrik_ai_core/marking.py';
      if (selector === 'packages/ai-core/src/cybrik_ai_core/policy.py') return f => f === 'packages/ai-core/src/cybrik_ai_core/policy.py';
      if (selector === 'packages/ai-core/src/cybrik_ai_core/prompts.py') return f => f === 'packages/ai-core/src/cybrik_ai_core/prompts.py';
      if (selector === 'packages/ai-core/src/cybrik_ai_core/telemetry.py') return f => f === 'packages/ai-core/src/cybrik_ai_core/telemetry.py';
      if (selector === 'packages/ai-core/src/cybrik_ai_core/errors.py') return f => f === 'packages/ai-core/src/cybrik_ai_core/errors.py';
      if (selector.includes('contract/ (common.py, inference.py, lifecycle.py, summarization.py)')) {
        return f => ['packages/ai-core/src/cybrik_ai_core/contract/common.py', 'packages/ai-core/src/cybrik_ai_core/contract/inference.py', 'packages/ai-core/src/cybrik_ai_core/contract/lifecycle.py', 'packages/ai-core/src/cybrik_ai_core/contract/summarization.py'].includes(f);
      }
      if (selector.includes('modelrt/ (budget.py, port.py, resilience.py, types.py)')) {
        return f => ['packages/ai-core/src/cybrik_ai_core/modelrt/budget.py', 'packages/ai-core/src/cybrik_ai_core/modelrt/port.py', 'packages/ai-core/src/cybrik_ai_core/modelrt/resilience.py', 'packages/ai-core/src/cybrik_ai_core/modelrt/types.py'].includes(f);
      }
      if (selector.includes('orchestration/ (attempt.py, controller.py, durable.py, durable_controller.py, ports.py, state.py, errors.py)')) {
        return f => ['packages/ai-core/src/cybrik_ai_core/orchestration/attempt.py', 'packages/ai-core/src/cybrik_ai_core/orchestration/controller.py', 'packages/ai-core/src/cybrik_ai_core/orchestration/durable.py', 'packages/ai-core/src/cybrik_ai_core/orchestration/durable_controller.py', 'packages/ai-core/src/cybrik_ai_core/orchestration/ports.py', 'packages/ai-core/src/cybrik_ai_core/orchestration/state.py', 'packages/ai-core/src/cybrik_ai_core/orchestration/errors.py'].includes(f);
      }
      if (selector === 'packages/ai-core/src/cybrik_ai_core/orchestration/checkpoints.py') return f => f === 'packages/ai-core/src/cybrik_ai_core/orchestration/checkpoints.py';
      if (selector === 'packages/ai-core/src/cybrik_ai_core/orchestration/memory.py') return f => f === 'packages/ai-core/src/cybrik_ai_core/orchestration/memory.py';
      if (selector.includes('security/ (egress.py, untrusted.py)')) {
        return f => ['packages/ai-core/src/cybrik_ai_core/security/egress.py', 'packages/ai-core/src/cybrik_ai_core/security/untrusted.py'].includes(f);
      }
      if (selector.includes('delegation/ (audit.py, contract.py, ports.py, trust.py, verifier.py, errors.py)')) {
        return f => ['packages/ai-core/src/cybrik_ai_core/delegation/audit.py', 'packages/ai-core/src/cybrik_ai_core/delegation/contract.py', 'packages/ai-core/src/cybrik_ai_core/delegation/ports.py', 'packages/ai-core/src/cybrik_ai_core/delegation/trust.py', 'packages/ai-core/src/cybrik_ai_core/delegation/verifier.py', 'packages/ai-core/src/cybrik_ai_core/delegation/errors.py'].includes(f);
      }
      if (selector === 'packages/ai-core/src/cybrik_ai_core/delegation/replay.py') return f => f === 'packages/ai-core/src/cybrik_ai_core/delegation/replay.py';
      if (selector.includes('delegation/ (certbind.py, jose.py)')) {
        return f => ['packages/ai-core/src/cybrik_ai_core/delegation/certbind.py', 'packages/ai-core/src/cybrik_ai_core/delegation/jose.py'].includes(f);
      }
      if (selector === 'services/ai-api/src/cybrik_ai_api/adapters/ollama.py') return f => f === 'services/ai-api/src/cybrik_ai_api/adapters/ollama.py';
      if (selector === 'services/ai-api/src/cybrik_ai_api/adapters/stub.py') return f => f === 'services/ai-api/src/cybrik_ai_api/adapters/stub.py';
      if (selector === 'services/ai-api/src/cybrik_ai_api/orchestration/postgres.py') return f => f === 'services/ai-api/src/cybrik_ai_api/orchestration/postgres.py';
      if (selector.includes('services/ai-api/migrations/')) {
        return f => f.startsWith('services/ai-api/migrations/');
      }
      if (selector === 'services/ai-api/src/cybrik_ai_api/transport_security.py') return f => f === 'services/ai-api/src/cybrik_ai_api/transport_security.py';
      if (selector.includes('investigations/ (service.py, relying_party.py, projection.py)')) {
        return f => ['services/ai-api/src/cybrik_ai_api/investigations/service.py', 'services/ai-api/src/cybrik_ai_api/investigations/relying_party.py', 'services/ai-api/src/cybrik_ai_api/investigations/projection.py'].includes(f);
      }
      if (selector === 'services/ai-api/src/cybrik_ai_api/investigations/api.py') return f => f === 'services/ai-api/src/cybrik_ai_api/investigations/api.py';
      if (selector === 'services/ai-api/src/cybrik_ai_api/summarize/service.py') return f => f === 'services/ai-api/src/cybrik_ai_api/summarize/service.py';
      if (selector.includes('app.py, runtime_composition.py, runtime_settings.py')) {
        return f => ['services/ai-api/src/cybrik_ai_api/app.py', 'services/ai-api/src/cybrik_ai_api/runtime_composition.py', 'services/ai-api/src/cybrik_ai_api/runtime_settings.py'].includes(f);
      }
      if (selector.includes('services/ai-worker/')) {
        return f => f.startsWith('services/ai-worker/');
      }
      if (selector.includes('tests/ (excluding README.md), .github/')) {
        return f => (f.startsWith('tests/') && f !== 'tests/README.md') || f.startsWith('.github/');
      }
      if (selector.includes('packages/**/__init__.py, services/ai-api/**/__init__.py')) {
        return f => f.endsWith('__init__.py') && !f.startsWith('services/ai-worker/');
      }
      if (selector.startsWith('docs/')) {
        return f => f.startsWith('docs/') || ['AGENTS.md', 'CLAUDE.md', 'README.md', 'SECURITY.md', 'tests/README.md', 'pyproject.toml', 'packages/ai-core/pyproject.toml', 'packages/ai-core/src/cybrik_ai_core/py.typed', 'services/ai-api/pyproject.toml', 'services/ai-api/src/cybrik_ai_api/py.typed', 'uv.lock', '.python-version', '.gitleaks.toml', '.gitignore'].includes(f);
      }
    }

    if (repo === 'cybrik-security-tool-fabric') {
      if (selector.includes('contracts/ (alert_context.py, capability.py, effects.py, invocation.py, provenance.py)')) {
        return f => ['src/control-plane/cybrik_fabric_control/contracts/alert_context.py', 'src/control-plane/cybrik_fabric_control/contracts/capability.py', 'src/control-plane/cybrik_fabric_control/contracts/effects.py', 'src/control-plane/cybrik_fabric_control/contracts/invocation.py', 'src/control-plane/cybrik_fabric_control/contracts/provenance.py'].includes(f);
      }
      if (selector.includes('contracts/ (jcs.py, loader.py)')) {
        return f => ['src/control-plane/cybrik_fabric_control/contracts/jcs.py', 'src/control-plane/cybrik_fabric_control/contracts/loader.py'].includes(f);
      }
      if (selector.includes('invocation/ (models.py, service.py)')) {
        return f => ['src/control-plane/cybrik_fabric_control/invocation/models.py', 'src/control-plane/cybrik_fabric_control/invocation/service.py'].includes(f);
      }
      if (selector === 'src/control-plane/cybrik_fabric_control/invocation/ports.py') return f => f === 'src/control-plane/cybrik_fabric_control/invocation/ports.py';
      if (selector === 'src/control-plane/cybrik_fabric_control/registry/packet.py') return f => f === 'src/control-plane/cybrik_fabric_control/registry/packet.py';
      if (selector.includes('app.py, liveness.py')) {
        return f => ['src/control-plane/cybrik_fabric_control/app.py', 'src/control-plane/cybrik_fabric_control/liveness.py'].includes(f);
      }
      if (selector === 'src/control-plane/cybrik_fabric_control/**/__init__.py') {
        return f => f.startsWith('src/control-plane/cybrik_fabric_control/') && f.endsWith('__init__.py');
      }
      if (selector === 'src/executor/internal/tier/tier.go') return f => f === 'src/executor/internal/tier/tier.go';
      if (selector === 'src/executor/internal/version/version.go') return f => f === 'src/executor/internal/version/version.go';
      if (selector === 'src/executor/cmd/executor/main.go') return f => f === 'src/executor/cmd/executor/main.go';
      if (selector === 'contracts-vendor/json-schema/') return f => f.startsWith('contracts-vendor/json-schema/');
      if (selector.includes('tests/ (excluding **/README.md), contracts-vendor/fixtures/')) {
        return f => (f.startsWith('tests/') && !f.endsWith('README.md')) ||
                    f.startsWith('contracts-vendor/fixtures/') ||
                    f === 'contracts-vendor/contracts.lock.json' ||
                    (f.startsWith('contracts-vendor/compatibility/') && f.endsWith('.manifest.json')) ||
                    (f.startsWith('src/executor/internal/') && f.endsWith('_test.go')) ||
                    f === 'src/executor/cmd/executor/main_test.go' ||
                    f.startsWith('.github/');
      }
      if (selector.startsWith('docs/, AGENTS.md')) {
        return f => f.startsWith('docs/') ||
                    ['AGENTS.md', 'CLAUDE.md', 'README.md', 'SECURITY.md', 'src/README.md', 'src/control-plane/README.md', 'src/executor/README.md', '.gitignore', 'src/control-plane/cybrik_fabric_control/py.typed', 'src/control-plane/cybrik_fabric_control/__about__.py', 'contracts-vendor/README.md'].includes(f) ||
                    (f.startsWith('src/executor/tiers/') && f.endsWith('.md')) ||
                    (f.startsWith('tests/') && f.endsWith('README.md'));
      }
      if (selector.startsWith('src/control-plane/pyproject.toml')) {
        return f => ['src/control-plane/pyproject.toml', 'src/control-plane/requirements.in', 'src/control-plane/requirements.lock', 'src/control-plane/requirements-dev.in', 'src/control-plane/requirements-dev.lock', 'src/executor/go.mod', 'src/executor/go.sum', 'src/executor/.golangci.yml', 'Dockerfile', 'src/control-plane/Dockerfile', 'src/executor/Dockerfile'].includes(f);
      }
    }

    if (repo === 'cybrik-soc-command-center') {
      if (selector === 'START-CYBRIK.command, STOP-CYBRIK.command') return f => ['START-CYBRIK.command', 'STOP-CYBRIK.command'].includes(f);
      if (selector === 'Makefile, services/api/.coverage, services/api/dump.rdb') return f => ['Makefile', 'services/api/.coverage', 'services/api/dump.rdb'].includes(f);
      if (selector.startsWith('.dockerignore, .gitignore')) {
        return f => ['.dockerignore', '.gitignore', '.gitleaks.toml', '.gitleaksignore', 'CLAUDE.md', 'LICENSE', 'README.md', 'SECURITY.md', 'SPRINT-0-CLOSURE.md', 'SPRINT-0-IMPLEMENTATION-PLAN.md'].includes(f);
      }
      if (selector.includes('apps/soc-portal/ (app/, components/, lib/, public/)')) {
        return f => (f.startsWith('apps/soc-portal/app/') || f.startsWith('apps/soc-portal/components/') || f.startsWith('apps/soc-portal/lib/') || f.startsWith('apps/soc-portal/public/'));
      }
      if (selector.includes('apps/soc-portal/ (e2e/, ui-review/, playwright.config.ts)')) {
        return f => f.startsWith('apps/soc-portal/e2e/') || f.startsWith('apps/soc-portal/ui-review/') || f === 'apps/soc-portal/playwright.config.ts';
      }
      if (selector.includes('apps/soc-portal/ (package.json,')) {
        return f => ['apps/soc-portal/package.json', 'apps/soc-portal/package-lock.json', 'apps/soc-portal/tsconfig.json', 'apps/soc-portal/next.config.mjs', 'apps/soc-portal/next-env.d.ts', 'apps/soc-portal/Dockerfile', 'apps/soc-portal/README.md'].includes(f);
      }
      if (selector.startsWith('connectors/')) return f => f.startsWith('connectors/');
      if (selector.includes('deploy/ (docker/docker-compose*.yml')) {
        return f => f.startsWith('deploy/') &&
                    !f.startsWith('deploy/log-collection/signer/') &&
                    !['deploy/docker/dev_endpoints.py', 'deploy/docker/screenshots/capture.mjs', 'deploy/docker/backup/Dockerfile', 'deploy/docker/screenshots/Dockerfile'].includes(f) &&
                    !f.endsWith('.md');
      }
      if (selector.includes('deploy/log-collection/signer/')) {
        return f => f.startsWith('deploy/log-collection/signer/');
      }
      if (selector.includes('deploy/ (docker/dev_endpoints.py, docker/screenshots/capture.mjs)')) {
        return f => ['deploy/docker/dev_endpoints.py', 'deploy/docker/screenshots/capture.mjs'].includes(f);
      }
      if (selector.includes('deploy/ (README.md, **/README.md, **/AGENT-DESIGN.md, docker/backup/Dockerfile, docker/screenshots/Dockerfile)')) {
        return f => (f.startsWith('deploy/') && f.endsWith('.md')) || ['deploy/docker/backup/Dockerfile', 'deploy/docker/screenshots/Dockerfile'].includes(f);
      }
      if (selector.startsWith('packages/api-contracts/')) return f => f.startsWith('packages/api-contracts/');
      if (selector.startsWith('packages/design-system/')) return f => f.startsWith('packages/design-system/');
      if (selector.startsWith('scripts/')) return f => f.startsWith('scripts/');
      if (selector.includes('ops/backup/cybrik_backup/')) {
        return f => f.startsWith('ops/backup/cybrik_backup/') && f !== 'ops/backup/cybrik_backup/__init__.py';
      }
      if (selector === 'ops/backup/tests/') return f => f.startsWith('ops/backup/tests/');
      if (selector.startsWith('ops/backup/ (INTEGRATION-CHECKLIST.md')) {
        return f => ['ops/backup/INTEGRATION-CHECKLIST.md', 'ops/backup/README.md', 'ops/backup/pyproject.toml'].includes(f);
      }
      if (selector.includes('ops/pf-bench/ (pf_bench/')) {
        return f => f.startsWith('ops/pf-bench/') && !['ops/pf-bench/pyproject.toml', 'ops/pf-bench/.gitignore', 'ops/pf-bench/pf_bench/__init__.py'].includes(f);
      }
      if (selector.includes('ops/pf-bench/ (pyproject.toml, .gitignore, pf_bench/__init__.py)')) {
        return f => ['ops/pf-bench/pyproject.toml', 'ops/pf-bench/.gitignore', 'ops/pf-bench/pf_bench/__init__.py'].includes(f);
      }
      if (selector.includes('ops/pf-workers/pf_workers/ (alert_writer.py')) {
        return f => f.startsWith('ops/pf-workers/pf_workers/') && !f.startsWith('ops/pf-workers/pf_workers/correlation_rules/') && f !== 'ops/pf-workers/pf_workers/__init__.py';
      }
      if (selector.includes('ops/pf-workers/pf_workers/correlation_rules/')) {
        return f => f.startsWith('ops/pf-workers/pf_workers/correlation_rules/');
      }
      if (selector === 'ops/pf-workers/ (tests/, scripts/)') {
        return f => f.startsWith('ops/pf-workers/tests/') || f.startsWith('ops/pf-workers/scripts/');
      }
      if (selector.includes('ops/pf-workers/ (Dockerfile')) {
        return f => ['ops/pf-workers/Dockerfile', 'ops/pf-workers/Dockerfile.dockerignore', 'ops/pf-workers/README.md', 'ops/pf-workers/pyproject.toml', 'ops/pf-workers/.gitignore'].includes(f);
      }
      if (selector.includes('services/api/content/sigma/ (*.yml), services/api/content/ueba_baselines/ (*.yml)')) {
        return f => (f.startsWith('services/api/content/sigma/') && f.endsWith('.yml')) || (f.startsWith('services/api/content/ueba_baselines/') && f.endsWith('.yml'));
      }
      if (selector.includes('services/api/content/sigma/tests/ (*.json)')) {
        return f => f.startsWith('services/api/content/sigma/tests/');
      }
      if (selector === 'services/api/content/sigma/NOTICE.md') return f => f === 'services/api/content/sigma/NOTICE.md';
      if (selector.startsWith('services/api/alembic/')) return f => f.startsWith('services/api/alembic/');
      if (selector.includes('services/api/scripts/, services/api/tests/, .github/')) {
        return f => f.startsWith('services/api/scripts/') || f.startsWith('services/api/tests/') || f.startsWith('.github/');
      }
      if (selector.includes('services/api/src/cybrik_soc/ (config.py, main.py)')) {
        return f => ['services/api/src/cybrik_soc/config.py', 'services/api/src/cybrik_soc/main.py'].includes(f);
      }
      if (selector.includes('services/api/src/cybrik_soc/modules/alert/ (context/authorize.py')) {
        return f => ['services/api/src/cybrik_soc/modules/alert/context/authorize.py', 'services/api/src/cybrik_soc/modules/alert/context/clearance.py', 'services/api/src/cybrik_soc/modules/alert/context/digest.py', 'services/api/src/cybrik_soc/modules/alert/context/models.py', 'services/api/src/cybrik_soc/modules/alert/context/ports.py', 'services/api/src/cybrik_soc/modules/alert/context/redact.py', 'services/api/src/cybrik_soc/modules/alert/context/service.py'].includes(f);
      }
      if (selector.includes('services/api/src/cybrik_soc/modules/alert/ (api.py')) {
        return f => ['services/api/src/cybrik_soc/modules/alert/api.py', 'services/api/src/cybrik_soc/modules/alert/context/api.py', 'services/api/src/cybrik_soc/modules/alert/context/reader_pg.py', 'services/api/src/cybrik_soc/modules/alert/context/store_pg.py', 'services/api/src/cybrik_soc/modules/alert/context/wire.py', 'services/api/src/cybrik_soc/modules/alert/metrics.py', 'services/api/src/cybrik_soc/modules/alert/pagination.py', 'services/api/src/cybrik_soc/modules/alert/related.py', 'services/api/src/cybrik_soc/modules/alert/triage.py', 'services/api/src/cybrik_soc/modules/alert/models.py'].includes(f);
      }
      if (selector.includes('modules/asset/')) {
        return f => ['services/api/src/cybrik_soc/modules/asset/api.py', 'services/api/src/cybrik_soc/modules/asset/models.py'].includes(f);
      }
      if (selector.includes('modules/audit/')) {
        return f => ['services/api/src/cybrik_soc/modules/audit/api.py', 'services/api/src/cybrik_soc/modules/audit/models.py'].includes(f);
      }
      if (selector === 'services/api/src/cybrik_soc/modules/authorization/matrix.py') return f => f === 'services/api/src/cybrik_soc/modules/authorization/matrix.py';
      if (selector === 'services/api/src/cybrik_soc/modules/authorization/deps.py') return f => f === 'services/api/src/cybrik_soc/modules/authorization/deps.py';
      if (selector.includes('modules/case/')) {
        return f => ['services/api/src/cybrik_soc/modules/case/service.py', 'services/api/src/cybrik_soc/modules/case/api.py', 'services/api/src/cybrik_soc/modules/case/models.py'].includes(f);
      }
      if (selector.includes('modules/connector/')) {
        return f => ['services/api/src/cybrik_soc/modules/connector/api.py', 'services/api/src/cybrik_soc/modules/connector/bootstrap.py', 'services/api/src/cybrik_soc/modules/connector/models.py'].includes(f);
      }
      if (selector === 'services/api/src/cybrik_soc/modules/copilot/shadow_remote_contract.py') return f => f === 'services/api/src/cybrik_soc/modules/copilot/shadow_remote_contract.py';
      if (selector === 'services/api/src/cybrik_soc/modules/copilot/llm.py') return f => f === 'services/api/src/cybrik_soc/modules/copilot/llm.py';
      if (selector.includes('modules/copilot/ (api.py')) {
        return f => ['services/api/src/cybrik_soc/modules/copilot/api.py', 'services/api/src/cybrik_soc/modules/copilot/gateway.py', 'services/api/src/cybrik_soc/modules/copilot/lifecycle_create.py', 'services/api/src/cybrik_soc/modules/copilot/models.py', 'services/api/src/cybrik_soc/modules/copilot/shadow_remote.py', 'services/api/src/cybrik_soc/modules/copilot/shadow_suggest_worker.py', 'services/api/src/cybrik_soc/modules/copilot/tools.py'].includes(f);
      }
      if (selector.includes('modules/datalake/ (retention.py, search.py)')) {
        return f => ['services/api/src/cybrik_soc/modules/datalake/retention.py', 'services/api/src/cybrik_soc/modules/datalake/search.py'].includes(f);
      }
      if (selector.includes('modules/datalake/ (api.py, es_adapter.py, lifecycle.py, opensearch_adapter.py, orm.py, service.py)')) {
        return f => ['services/api/src/cybrik_soc/modules/datalake/api.py', 'services/api/src/cybrik_soc/modules/datalake/es_adapter.py', 'services/api/src/cybrik_soc/modules/datalake/lifecycle.py', 'services/api/src/cybrik_soc/modules/datalake/opensearch_adapter.py', 'services/api/src/cybrik_soc/modules/datalake/orm.py', 'services/api/src/cybrik_soc/modules/datalake/service.py'].includes(f);
      }
      if (selector.includes('modules/forensics/ (access_control.py')) {
        return f => ['services/api/src/cybrik_soc/modules/forensics/access_control.py', 'services/api/src/cybrik_soc/modules/forensics/case_link.py', 'services/api/src/cybrik_soc/modules/forensics/classification.py', 'services/api/src/cybrik_soc/modules/forensics/clearance.py', 'services/api/src/cybrik_soc/modules/forensics/collectors.py', 'services/api/src/cybrik_soc/modules/forensics/copilot_summary.py', 'services/api/src/cybrik_soc/modules/forensics/custody.py', 'services/api/src/cybrik_soc/modules/forensics/evidence.py', 'services/api/src/cybrik_soc/modules/forensics/integrity_sweep.py', 'services/api/src/cybrik_soc/modules/forensics/legal_report.py', 'services/api/src/cybrik_soc/modules/forensics/linkage.py', 'services/api/src/cybrik_soc/modules/forensics/pcap_analysis.py', 'services/api/src/cybrik_soc/modules/forensics/report.py', 'services/api/src/cybrik_soc/modules/forensics/timeline.py', 'services/api/src/cybrik_soc/modules/forensics/search.py'].includes(f);
      }
      if (selector.includes('modules/forensics/ (api.py')) {
        return f => ['services/api/src/cybrik_soc/modules/forensics/api.py', 'services/api/src/cybrik_soc/modules/forensics/endpoint.py', 'services/api/src/cybrik_soc/modules/forensics/models.py', 'services/api/src/cybrik_soc/modules/forensics/repo.py', 'services/api/src/cybrik_soc/modules/forensics/store.py'].includes(f);
      }
      if (selector.includes('modules/geoip/')) {
        return f => ['services/api/src/cybrik_soc/modules/geoip/api.py', 'services/api/src/cybrik_soc/modules/geoip/metrics.py', 'services/api/src/cybrik_soc/modules/geoip/reader.py'].includes(f);
      }
      if (selector.includes('modules/hunt/ (copilot_suggest.py, hunts.py')) {
        return f => ['services/api/src/cybrik_soc/modules/hunt/copilot_suggest.py', 'services/api/src/cybrik_soc/modules/hunt/hunts.py', 'services/api/src/cybrik_soc/modules/hunt/ioc_pivot.py', 'services/api/src/cybrik_soc/modules/hunt/pivot.py', 'services/api/src/cybrik_soc/modules/hunt/promote.py', 'services/api/src/cybrik_soc/modules/hunt/query_spec.py', 'services/api/src/cybrik_soc/modules/hunt/sigma.py'].includes(f);
      }
      if (selector === 'services/api/src/cybrik_soc/modules/hunt/executions.py') return f => f === 'services/api/src/cybrik_soc/modules/hunt/executions.py';
      if (selector === 'services/api/src/cybrik_soc/modules/hunt/compiler_sql.py') return f => f === 'services/api/src/cybrik_soc/modules/hunt/compiler_sql.py';
      if (selector.includes('modules/hunt/ (api.py')) {
        return f => ['services/api/src/cybrik_soc/modules/hunt/api.py', 'services/api/src/cybrik_soc/modules/hunt/datalake.py', 'services/api/src/cybrik_soc/modules/hunt/models.py', 'services/api/src/cybrik_soc/modules/hunt/orm.py'].includes(f);
      }
      if (selector.includes('modules/identity/')) {
        return f => ['services/api/src/cybrik_soc/modules/identity/api.py', 'services/api/src/cybrik_soc/modules/identity/membership.py', 'services/api/src/cybrik_soc/modules/identity/membership_api.py', 'services/api/src/cybrik_soc/modules/identity/models.py', 'services/api/src/cybrik_soc/modules/identity/service.py'].includes(f);
      }
      if (selector.includes('modules/ingest/ (source_labels.py, time_guard.py)')) {
        return f => ['services/api/src/cybrik_soc/modules/ingest/source_labels.py', 'services/api/src/cybrik_soc/modules/ingest/time_guard.py'].includes(f);
      }
      if (selector.includes('modules/ingest/ (api.py, ecs.py, field_maps.py')) {
        return f => ['services/api/src/cybrik_soc/modules/ingest/api.py', 'services/api/src/cybrik_soc/modules/ingest/ecs.py', 'services/api/src/cybrik_soc/modules/ingest/field_maps.py', 'services/api/src/cybrik_soc/modules/ingest/log_parsers.py', 'services/api/src/cybrik_soc/modules/ingest/log_parsers_bsd.py', 'services/api/src/cybrik_soc/modules/ingest/log_parsers_ext.py', 'services/api/src/cybrik_soc/modules/ingest/models.py', 'services/api/src/cybrik_soc/modules/ingest/normalizers.py', 'services/api/src/cybrik_soc/modules/ingest/ocsf.py', 'services/api/src/cybrik_soc/modules/ingest/pf_bridge.py', 'services/api/src/cybrik_soc/modules/ingest/security_onion.py', 'services/api/src/cybrik_soc/modules/ingest/service.py', 'services/api/src/cybrik_soc/modules/ingest/source_health.py', 'services/api/src/cybrik_soc/modules/ingest/source_health_worker.py'].includes(f);
      }
      if (selector.includes('modules/ioc/ (normalize.py, stix.py)')) {
        return f => ['services/api/src/cybrik_soc/modules/ioc/normalize.py', 'services/api/src/cybrik_soc/modules/ioc/stix.py'].includes(f);
      }
      if (selector.includes('modules/ioc/ (api.py')) {
        return f => ['services/api/src/cybrik_soc/modules/ioc/api.py', 'services/api/src/cybrik_soc/modules/ioc/csv_import.py', 'services/api/src/cybrik_soc/modules/ioc/feeds_api.py', 'services/api/src/cybrik_soc/modules/ioc/match.py', 'services/api/src/cybrik_soc/modules/ioc/metrics.py', 'services/api/src/cybrik_soc/modules/ioc/models.py', 'services/api/src/cybrik_soc/modules/ioc/taxii.py'].includes(f);
      }
      if (selector.includes('modules/org/ (contract.py, scoping.py)')) {
        return f => ['services/api/src/cybrik_soc/modules/org/contract.py', 'services/api/src/cybrik_soc/modules/org/scoping.py'].includes(f);
      }
      if (selector.includes('modules/org/ (api.py')) {
        return f => ['services/api/src/cybrik_soc/modules/org/api.py', 'services/api/src/cybrik_soc/modules/org/models.py', 'services/api/src/cybrik_soc/modules/org/session.py'].includes(f);
      }
      if (selector.includes('modules/prefs/')) {
        return f => ['services/api/src/cybrik_soc/modules/prefs/api.py', 'services/api/src/cybrik_soc/modules/prefs/models.py'].includes(f);
      }
      if (selector.includes('modules/siem/ (correlation.py')) {
        return f => ['services/api/src/cybrik_soc/modules/siem/correlation.py', 'services/api/src/cybrik_soc/modules/siem/engine.py', 'services/api/src/cybrik_soc/modules/siem/field_mapping.py', 'services/api/src/cybrik_soc/modules/siem/rules.py', 'services/api/src/cybrik_soc/modules/siem/sigma.py', 'services/api/src/cybrik_soc/modules/siem/sigma_match.py'].includes(f);
      }
      if (selector.includes('modules/siem/ (api.py')) {
        return f => ['services/api/src/cybrik_soc/modules/siem/api.py', 'services/api/src/cybrik_soc/modules/siem/orm.py'].includes(f);
      }
      if (selector.includes('modules/soar/ (actions.py')) {
        return f => ['services/api/src/cybrik_soc/modules/soar/actions.py', 'services/api/src/cybrik_soc/modules/soar/audit.py', 'services/api/src/cybrik_soc/modules/soar/context.py', 'services/api/src/cybrik_soc/modules/soar/copilot_draft.py', 'services/api/src/cybrik_soc/modules/soar/copilot_tool.py', 'services/api/src/cybrik_soc/modules/soar/engine.py', 'services/api/src/cybrik_soc/modules/soar/guards.py', 'services/api/src/cybrik_soc/modules/soar/playbook.py', 'services/api/src/cybrik_soc/modules/soar/report.py', 'services/api/src/cybrik_soc/modules/soar/samples.py', 'services/api/src/cybrik_soc/modules/soar/serialize.py', 'services/api/src/cybrik_soc/modules/soar/simulate.py'].includes(f);
      }
      if (selector.includes('modules/soar/ (api.py')) {
        return f => ['services/api/src/cybrik_soc/modules/soar/api.py', 'services/api/src/cybrik_soc/modules/soar/connectors/__init__.py', 'services/api/src/cybrik_soc/modules/soar/connectors/fortigate.py', 'services/api/src/cybrik_soc/modules/soar/copilot_seam.py', 'services/api/src/cybrik_soc/modules/soar/expire_worker.py', 'services/api/src/cybrik_soc/modules/soar/library.py', 'services/api/src/cybrik_soc/modules/soar/orm.py', 'services/api/src/cybrik_soc/modules/soar/runtime.py'].includes(f);
      }
      if (selector.includes('modules/tenant/')) {
        return f => ['services/api/src/cybrik_soc/modules/tenant/api.py', 'services/api/src/cybrik_soc/modules/tenant/models.py', 'services/api/src/cybrik_soc/modules/tenant/service.py'].includes(f);
      }
      if (selector.includes('modules/ueba/ (alerts.py')) {
        return f => ['services/api/src/cybrik_soc/modules/ueba/alerts.py', 'services/api/src/cybrik_soc/modules/ueba/baseline.py', 'services/api/src/cybrik_soc/modules/ueba/baseline_pack.py', 'services/api/src/cybrik_soc/modules/ueba/classification.py', 'services/api/src/cybrik_soc/modules/ueba/detect.py', 'services/api/src/cybrik_soc/modules/ueba/detectors_ah.py', 'services/api/src/cybrik_soc/modules/ueba/detectors_bc.py', 'services/api/src/cybrik_soc/modules/ueba/detectors_dx.py', 'services/api/src/cybrik_soc/modules/ueba/detectors_lm.py', 'services/api/src/cybrik_soc/modules/ueba/detectors_pg.py', 'services/api/src/cybrik_soc/modules/ueba/detectors_ua.py', 'services/api/src/cybrik_soc/modules/ueba/engine.py', 'services/api/src/cybrik_soc/modules/ueba/events.py', 'services/api/src/cybrik_soc/modules/ueba/features.py', 'services/api/src/cybrik_soc/modules/ueba/findings.py', 'services/api/src/cybrik_soc/modules/ueba/iforest.py', 'services/api/src/cybrik_soc/modules/ueba/risk.py', 'services/api/src/cybrik_soc/modules/ueba/stats.py'].includes(f);
      }
      if (selector.includes('modules/ueba/ (api.py')) {
        return f => ['services/api/src/cybrik_soc/modules/ueba/api.py', 'services/api/src/cybrik_soc/modules/ueba/learning_worker.py', 'services/api/src/cybrik_soc/modules/ueba/orm.py'].includes(f);
      }
      if (selector.includes('modules/vulnerability/ (compliance.py, consolidation.py, correlation.py, cve_enrichment.py, exceptions.py, intel.py, lifecycle.py, models.py, parsers/common.py, policy_config.py, remediation.py, reporting.py, rescore.py, risk.py)')) {
        return f => ['services/api/src/cybrik_soc/modules/vulnerability/compliance.py', 'services/api/src/cybrik_soc/modules/vulnerability/consolidation.py', 'services/api/src/cybrik_soc/modules/vulnerability/correlation.py', 'services/api/src/cybrik_soc/modules/vulnerability/cve_enrichment.py', 'services/api/src/cybrik_soc/modules/vulnerability/exceptions.py', 'services/api/src/cybrik_soc/modules/vulnerability/intel.py', 'services/api/src/cybrik_soc/modules/vulnerability/lifecycle.py', 'services/api/src/cybrik_soc/modules/vulnerability/models.py', 'services/api/src/cybrik_soc/modules/vulnerability/parsers/common.py', 'services/api/src/cybrik_soc/modules/vulnerability/policy_config.py', 'services/api/src/cybrik_soc/modules/vulnerability/remediation.py', 'services/api/src/cybrik_soc/modules/vulnerability/reporting.py', 'services/api/src/cybrik_soc/modules/vulnerability/rescore.py', 'services/api/src/cybrik_soc/modules/vulnerability/risk.py'].includes(f);
      }
      if (selector.includes('modules/vulnerability/ (api.py, orm.py, repo.py, service.py, parsers/generic.py, parsers/greenbone.py, parsers/grype.py, parsers/nmap.py, parsers/nuclei.py, parsers/trivy.py, parsers/__init__.py)')) {
        return f => ['services/api/src/cybrik_soc/modules/vulnerability/api.py', 'services/api/src/cybrik_soc/modules/vulnerability/orm.py', 'services/api/src/cybrik_soc/modules/vulnerability/repo.py', 'services/api/src/cybrik_soc/modules/vulnerability/service.py', 'services/api/src/cybrik_soc/modules/vulnerability/parsers/generic.py', 'services/api/src/cybrik_soc/modules/vulnerability/parsers/greenbone.py', 'services/api/src/cybrik_soc/modules/vulnerability/parsers/grype.py', 'services/api/src/cybrik_soc/modules/vulnerability/parsers/nmap.py', 'services/api/src/cybrik_soc/modules/vulnerability/parsers/nuclei.py', 'services/api/src/cybrik_soc/modules/vulnerability/parsers/trivy.py', 'services/api/src/cybrik_soc/modules/vulnerability/parsers/__init__.py'].includes(f);
      }
      if (selector.includes('platform/ (client_ip.py')) {
        return f => ['services/api/src/cybrik_soc/platform/client_ip.py', 'services/api/src/cybrik_soc/platform/context.py', 'services/api/src/cybrik_soc/platform/logging.py', 'services/api/src/cybrik_soc/platform/provenance.py'].includes(f);
      }
      if (selector.includes('platform/ (audit_support.py')) {
        return f => ['services/api/src/cybrik_soc/platform/audit_support.py', 'services/api/src/cybrik_soc/platform/database.py', 'services/api/src/cybrik_soc/platform/errors.py', 'services/api/src/cybrik_soc/platform/hooks.py', 'services/api/src/cybrik_soc/platform/http_body.py', 'services/api/src/cybrik_soc/platform/outbound.py', 'services/api/src/cybrik_soc/platform/rate_limit.py', 'services/api/src/cybrik_soc/platform/secrets.py', 'services/api/src/cybrik_soc/platform/security.py', 'services/api/src/cybrik_soc/platform/signing.py', 'services/api/src/cybrik_soc/platform/security_txt.py'].includes(f);
      }
      if (selector.includes('platform/svc_delegation/ (errors.py, models.py, scopes.py)')) {
        return f => ['services/api/src/cybrik_soc/platform/svc_delegation/errors.py', 'services/api/src/cybrik_soc/platform/svc_delegation/models.py', 'services/api/src/cybrik_soc/platform/svc_delegation/scopes.py'].includes(f);
      }
      if (selector.includes('platform/svc_delegation/ (algorithms.py, factory.py, issuer.py, principal_adapter.py, signer.py)')) {
        return f => ['services/api/src/cybrik_soc/platform/svc_delegation/algorithms.py', 'services/api/src/cybrik_soc/platform/svc_delegation/factory.py', 'services/api/src/cybrik_soc/platform/svc_delegation/issuer.py', 'services/api/src/cybrik_soc/platform/svc_delegation/principal_adapter.py', 'services/api/src/cybrik_soc/platform/svc_delegation/signer.py'].includes(f);
      }
      if (selector.includes('services/api/src/cybrik_soc/**/__init__.py')) {
        return f => (f.startsWith('services/api/src/cybrik_soc/') || f.startsWith('ops/backup/') || f.startsWith('ops/pf-workers/')) &&
                    f.endsWith('__init__.py') &&
                    !['services/api/src/cybrik_soc/modules/soar/connectors/__init__.py', 'services/api/src/cybrik_soc/modules/vulnerability/parsers/__init__.py', 'ops/pf-bench/pf_bench/__init__.py'].includes(f);
      }
      if (selector.includes('services/api/src/cybrik_soc/modules/*/README.md')) {
        return f => (f.startsWith('services/api/src/cybrik_soc/modules/') && f.endsWith('README.md')) || f === 'services/api/src/cybrik_soc/modules/ioc/STIX-TAXII-INTEGRATION-NOTES.md';
      }
      if (selector.startsWith('docs/, governance/')) {
        return f => f.startsWith('docs/') || f.startsWith('governance/') || f.startsWith('reports/') || f.startsWith('artifacts/') || f.startsWith('backlog/') || f.startsWith('third-party/') || ['services/api/Dockerfile', 'services/api/alembic.ini', 'pyproject.toml', 'services/api/pyproject.toml'].includes(f);
      }
    }

    throw new Error(`Unrecognized selector for ${repo}: ${selector}`);
  }

  for (const repo of ['cybrik-cyber-ai-platform', 'cybrik-security-tool-fabric', 'cybrik-soc-command-center']) {
    const rows = repoRowMap[repo];
    const files = Object.keys(ledger[repo].files);
    const matchers = rows.map(r => ({ ...r, fn: createMatcher(r.selector, repo) }));

    for (const filePath of files) {
      const ledgerEntry = ledger[repo].files[filePath];
      const matches = matchers.filter(m => m.fn(filePath));
      if (matches.length === 0) {
        throw new Error(`${repo}:${filePath} is an UNMATCHED ORPHAN not covered by any map row selector`);
      }
      if (matches.length > 1) {
        throw new Error(`${repo}:${filePath} has OVERLAPPING matches in map lines ${matches.map(m => m.lineNum).join(', ')}`);
      }
      const match = matches[0];
      if (match.classification !== ledgerEntry.classification) {
        throw new Error(`${repo}:${filePath} classification mismatch: map=${match.classification} vs ledger=${ledgerEntry.classification}`);
      }
      if (match.status !== ledgerEntry.status) {
        throw new Error(`${repo}:${filePath} status mismatch: map=${match.status} vs ledger=${ledgerEntry.status}`);
      }
    }
  }

  console.log(`PASS: OPEN-11 Product Module Sovereignty Classification Map (${lines.length} lines, 117 rows: 28/14/73/2) and 1,650-file Ledger (SHA-256: ${ledgerDigest}) integrity, exhaustive selector closure, and semantic sentinels verified.`);

  H('20', true, 'OPEN-11 classification map and 1,650-file ledger pass pinned integrity, exhaustive selector closure, and semantic sentinel validation');
} catch (e) {
  fail(e.message);
}

console.log('=== JSON Schema / packet / invariants validation ===');
console.log('counts:', JSON.stringify(counts));
if (notes.length) for (const n of notes) console.log('note:', n);
if (errors.length) {
  console.error(`\nFAIL — ${errors.length} error(s):`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log('\nOK — all schema/packet/invariant checks passed.');
