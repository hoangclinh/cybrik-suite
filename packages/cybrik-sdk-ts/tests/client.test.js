import { describe, it } from 'node:test';
import assert from 'node:assert';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const distPath = fileURLToPath(new URL('../dist/index.js', import.meta.url));
if (!existsSync(distPath)) {
  const pkgDir = fileURLToPath(new URL('..', import.meta.url));
  try {
    execSync('npx tsc', { cwd: pkgDir, stdio: 'pipe' });
  } catch {
    // fallback if npx tsc not globally mapped
  }
}

const {
  CybrikClient,
  CybrikSDKError,
  CybrikAuthenticationError,
  CybrikAuthorizationError,
  CybrikNotFoundError,
  CybrikRateLimitError,
  CybrikServerError,
  CybrikTimeoutError,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
} = await import('../dist/index.js');

describe('CybrikClient Initialization', () => {
  it('initializes with minimal valid options and defaults', () => {
    const client = new CybrikClient({
      endpoint: 'https://soc.cybrik.io',
    });

    assert.strictEqual(client.endpoint, 'https://soc.cybrik.io');
    assert.strictEqual(client.timeoutMs, DEFAULT_TIMEOUT_MS);
    assert.strictEqual(client.apiToken, undefined);
    assert.strictEqual(client.tenantId, undefined);
    assert.deepStrictEqual(client.customHeaders, {});
  });

  it('normalizes endpoint by trimming whitespace and trailing slashes', () => {
    const client = new CybrikClient({
      endpoint: '  https://soc.cybrik.io/api///  ',
      timeoutMs: 15000,
      apiToken: 'test-token',
      tenantId: 'tenant-123',
      customHeaders: { 'X-Custom-Env': 'testing' },
    });

    assert.strictEqual(client.endpoint, 'https://soc.cybrik.io/api');
    assert.strictEqual(client.timeoutMs, 15000);
    assert.strictEqual(client.apiToken, 'test-token');
    assert.strictEqual(client.tenantId, 'tenant-123');
    assert.strictEqual(client.customHeaders['X-Custom-Env'], 'testing');
  });

  it('throws CybrikSDKError if endpoint is missing or empty', () => {
    assert.throws(
      () => new CybrikClient({ endpoint: '' }),
      (err) => err instanceof CybrikSDKError && err.code === 'INVALID_CONFIG'
    );
    assert.throws(
      () => new CybrikClient({ endpoint: '   ' }),
      (err) => err instanceof CybrikSDKError && err.code === 'INVALID_CONFIG'
    );
  });
});

describe('Header Injection and Request Building', () => {
  it('injects User-Agent, Accept, Authorization, and X-Tenant-ID headers', async () => {
    let capturedUrl = '';
    let capturedOptions = null;

    const mockFetch = async (url, options) => {
      capturedUrl = url.toString();
      capturedOptions = options;
      return new Response(JSON.stringify({ status: 'healthy', version: '0.1.0', timestamp: '2026-09-07T00:00:00Z' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new CybrikClient({
      endpoint: 'https://soc.cybrik.io',
      apiToken: 'cyb-sec-token-abc',
      tenantId: 'tenant-enterprise-1',
      customHeaders: { 'X-Trace-ID': 'trace-98765' },
      fetch: mockFetch,
    });

    const health = await client.getHealth();
    assert.strictEqual(health.status, 'healthy');
    assert.strictEqual(capturedUrl, 'https://soc.cybrik.io/health');

    assert.strictEqual(capturedOptions.headers['User-Agent'], DEFAULT_USER_AGENT);
    assert.strictEqual(capturedOptions.headers['Accept'], 'application/json');
    assert.strictEqual(capturedOptions.headers['Authorization'], 'Bearer cyb-sec-token-abc');
    assert.strictEqual(capturedOptions.headers['X-Tenant-ID'], 'tenant-enterprise-1');
    assert.strictEqual(capturedOptions.headers['X-Trace-ID'], 'trace-98765');
  });

  it('injects Content-Type: application/json for requests with a payload', async () => {
    let capturedOptions = null;

    const mockFetch = async (url, options) => {
      capturedOptions = options;
      return new Response(
        JSON.stringify({ accepted: true, count: 1, batch_id: 'batch-1' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const client = new CybrikClient({
      endpoint: 'https://soc.cybrik.io',
      tenantId: 'tenant-42',
      fetch: mockFetch,
    });

    await client.ingestEvents([{ event_type: 'process_creation', pid: 1337 }]);

    assert.strictEqual(capturedOptions.headers['Content-Type'], 'application/json');
    const parsedBody = JSON.parse(capturedOptions.body);
    assert.strictEqual(parsedBody.tenant_id, 'tenant-42');
    assert.strictEqual(parsedBody.events.length, 1);
    assert.strictEqual(parsedBody.events[0].pid, 1337);
  });
});

describe('Simulated HTTP 200 Response Decoding', () => {
  it('decodes getHealth response correctly', async () => {
    const mockHealth = {
      status: 'healthy',
      version: '0.1.0',
      timestamp: '2026-09-07T12:00:00Z',
      details: { memory: 'ok', egress: 'connected' },
    };

    const client = new CybrikClient({
      endpoint: 'https://soc.cybrik.io',
      fetch: async () => new Response(JSON.stringify(mockHealth), { status: 200 }),
    });

    const result = await client.getHealth();
    assert.deepStrictEqual(result, mockHealth);
  });

  it('decodes ingestEvents response correctly', async () => {
    const mockReceipt = {
      accepted: true,
      count: 3,
      batch_id: 'batch-guid-777',
      errors: [],
    };

    const client = new CybrikClient({
      endpoint: 'https://soc.cybrik.io',
      fetch: async () => new Response(JSON.stringify(mockReceipt), { status: 200 }),
    });

    const result = await client.ingestEvents([
      { title: 'Evt1' },
      { title: 'Evt2' },
      { title: 'Evt3' },
    ]);
    assert.strictEqual(result.accepted, true);
    assert.strictEqual(result.count, 3);
    assert.strictEqual(result.batch_id, 'batch-guid-777');
  });

  it('decodes getAlert and validates alertId', async () => {
    let requestedUrl = '';
    const mockAlert = {
      alert_id: 'alt-4096',
      title: 'Privilege Escalation Attempt',
      severity: 'CRITICAL',
      status: 'INVESTIGATING',
      created_at: '2026-09-07T10:15:30Z',
      source: 'edr-sensor',
    };

    const client = new CybrikClient({
      endpoint: 'https://soc.cybrik.io',
      fetch: async (url) => {
        requestedUrl = url.toString();
        return new Response(JSON.stringify(mockAlert), { status: 200 });
      },
    });

    const alert = await client.getAlert('alt-4096');
    assert.strictEqual(requestedUrl, 'https://soc.cybrik.io/alerts/alt-4096');
    assert.strictEqual(alert.alert_id, 'alt-4096');
    assert.strictEqual(alert.severity, 'CRITICAL');

    await assert.rejects(
      () => client.getAlert(''),
      (err) => err instanceof CybrikSDKError && err.code === 'INVALID_ARGUMENT'
    );
  });

  it('decodes listAlerts with query parameters and array/wrapped response', async () => {
    let capturedUrl = '';
    const mockAlerts = [
      {
        alert_id: 'alt-1',
        title: 'Lateral Movement',
        severity: 'HIGH',
        status: 'NEW',
        created_at: '2026-09-07T08:00:00Z',
      },
    ];

    const client = new CybrikClient({
      endpoint: 'https://soc.cybrik.io',
      fetch: async (url) => {
        capturedUrl = url.toString();
        return new Response(JSON.stringify(mockAlerts), { status: 200 });
      },
    });

    const list = await client.listAlerts({ status: 'NEW', limit: 25, offset: 50 });
    assert.strictEqual(
      capturedUrl,
      'https://soc.cybrik.io/alerts?status=NEW&limit=25&offset=50'
    );
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].alert_id, 'alt-1');

    // Also verify envelope structure { alerts: [...] }
    const wrappedClient = new CybrikClient({
      endpoint: 'https://soc.cybrik.io',
      fetch: async () => new Response(JSON.stringify({ alerts: mockAlerts }), { status: 200 }),
    });
    const wrappedList = await wrappedClient.listAlerts();
    assert.strictEqual(wrappedList.length, 1);
  });
});

describe('HTTP Error Status Mapping', () => {
  it('maps HTTP 401 to CybrikAuthenticationError', async () => {
    const client = new CybrikClient({
      endpoint: 'https://soc.cybrik.io',
      fetch: async () =>
        new Response('Bearer token expired', {
          status: 401,
          statusText: 'Unauthorized',
        }),
    });

    await assert.rejects(
      () => client.getHealth(),
      (err) => {
        assert(err instanceof CybrikAuthenticationError);
        assert(err instanceof CybrikSDKError);
        assert.strictEqual(err.statusCode, 401);
        assert.strictEqual(err.code, 'AUTHENTICATION_ERROR');
        assert.strictEqual(err.responseBody, 'Bearer token expired');
        return true;
      }
    );
  });

  it('maps HTTP 403 to CybrikAuthorizationError', async () => {
    const client = new CybrikClient({
      endpoint: 'https://soc.cybrik.io',
      fetch: async () =>
        new Response('Forbidden action', {
          status: 403,
          statusText: 'Forbidden',
        }),
    });

    await assert.rejects(
      () => client.getAlert('alt-1'),
      (err) => {
        assert(err instanceof CybrikAuthorizationError);
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, 'AUTHORIZATION_ERROR');
        return true;
      }
    );
  });

  it('maps HTTP 404 to CybrikNotFoundError', async () => {
    const client = new CybrikClient({
      endpoint: 'https://soc.cybrik.io',
      fetch: async () =>
        new Response('Alert not found', {
          status: 404,
          statusText: 'Not Found',
        }),
    });

    await assert.rejects(
      () => client.getAlert('nonexistent-id'),
      (err) => {
        assert(err instanceof CybrikNotFoundError);
        assert.strictEqual(err.statusCode, 404);
        assert.strictEqual(err.code, 'NOT_FOUND_ERROR');
        return true;
      }
    );
  });

  it('maps HTTP 429 to CybrikRateLimitError with Retry-After integer parsing', async () => {
    const client = new CybrikClient({
      endpoint: 'https://soc.cybrik.io',
      fetch: async () =>
        new Response('Rate limit reached', {
          status: 429,
          headers: { 'Retry-After': '120' },
        }),
    });

    await assert.rejects(
      () => client.ingestEvents([{ event: 'probe' }]),
      (err) => {
        assert(err instanceof CybrikRateLimitError);
        assert.strictEqual(err.statusCode, 429);
        assert.strictEqual(err.code, 'RATE_LIMIT_ERROR');
        assert.strictEqual(err.retryAfterSeconds, 120);
        return true;
      }
    );
  });

  it('maps HTTP 429 to CybrikRateLimitError with Retry-After HTTP-Date parsing', async () => {
    const futureDate = new Date(Date.now() + 60000).toUTCString();
    const client = new CybrikClient({
      endpoint: 'https://soc.cybrik.io',
      fetch: async () =>
        new Response('Throttled', {
          status: 429,
          headers: { 'Retry-After': futureDate },
        }),
    });

    await assert.rejects(
      () => client.getHealth(),
      (err) => {
        assert(err instanceof CybrikRateLimitError);
        assert(err.retryAfterSeconds !== undefined && err.retryAfterSeconds > 0);
        return true;
      }
    );
  });

  it('maps HTTP 500 to CybrikServerError', async () => {
    const client = new CybrikClient({
      endpoint: 'https://soc.cybrik.io',
      fetch: async () =>
        new Response('Database cluster unreachable', {
          status: 500,
          statusText: 'Internal Server Error',
        }),
    });

    await assert.rejects(
      () => client.getHealth(),
      (err) => {
        assert(err instanceof CybrikServerError);
        assert.strictEqual(err.statusCode, 500);
        assert.strictEqual(err.code, 'SERVER_ERROR');
        assert.strictEqual(err.responseBody, 'Database cluster unreachable');
        return true;
      }
    );
  });

  it('maps HTTP 503 to CybrikServerError with appropriate statusCode', async () => {
    const client = new CybrikClient({
      endpoint: 'https://soc.cybrik.io',
      fetch: async () =>
        new Response('Service Unavailable', {
          status: 503,
          statusText: 'Service Unavailable',
        }),
    });

    await assert.rejects(
      () => client.listAlerts(),
      (err) => {
        assert(err instanceof CybrikServerError);
        assert.strictEqual(err.statusCode, 503);
        return true;
      }
    );
  });
});

describe('Request Timeout Handling', () => {
  it('throws CybrikTimeoutError when request exceeds timeoutMs', async () => {
    const client = new CybrikClient({
      endpoint: 'https://soc.cybrik.io',
      timeoutMs: 30,
      fetch: async (_url, options) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            resolve(new Response('OK', { status: 200 }));
          }, 200);

          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              clearTimeout(timer);
              const abortErr = new Error('The operation was aborted');
              abortErr.name = 'AbortError';
              reject(abortErr);
            });
          }
        });
      },
    });

    await assert.rejects(
      () => client.getHealth(),
      (err) => {
        assert(err instanceof CybrikTimeoutError);
        assert(err instanceof CybrikSDKError);
        assert.strictEqual(err.code, 'TIMEOUT_ERROR');
        assert(err.message.includes('timed out'));
        return true;
      }
    );
  });
});
