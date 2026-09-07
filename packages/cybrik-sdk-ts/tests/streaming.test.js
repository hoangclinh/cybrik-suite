import { describe, it } from 'node:test';
import assert from 'node:assert';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const distPath = fileURLToPath(new URL('../dist/index.js', import.meta.url));
if (!existsSync(distPath)) {
  const pkgDir = fileURLToPath(new URL('..', import.meta.url));
  try {
    execSync('npx -y typescript --project tsconfig.json', { cwd: pkgDir, stdio: 'pipe' });
  } catch {
    // fallback
  }
}

const {
  CybrikClient,
  AlertStreamSubscription,
  parseSSEStream,
  calculateBackoff,
  CybrikSDKError,
  CybrikAuthenticationError,
  CybrikAuthorizationError,
  CybrikNotFoundError,
  DEFAULT_STREAM_RECONNECT,
  DEFAULT_MAX_RECONNECT_ATTEMPTS,
  DEFAULT_INITIAL_BACKOFF_MS,
  DEFAULT_MAX_BACKOFF_MS,
} = await import('../dist/index.js');

/**
 * Helper to build a Web ReadableStream from string or Uint8Array chunks.
 */
function createChunkedStream(chunks) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        if (chunk instanceof Uint8Array) {
          controller.enqueue(chunk);
        } else {
          controller.enqueue(encoder.encode(chunk));
        }
      }
      controller.close();
    },
  });
}

describe('SSE Parser with Simulated Chunked Text Stream', () => {
  it('parses events split across arbitrary chunk boundaries', async () => {
    // Splits lines, keys, and json values across chunks
    const chunks = [
      'event: al',
      'ert.created\n',
      'id: evt-0',
      '01\n',
      'data: {"id": "al',
      't-100", "severity":',
      ' "CRITICAL"}\n\n',
    ];

    const stream = createChunkedStream(chunks);
    const events = [];

    for await (const event of parseSSEStream(stream)) {
      events.push(event);
    }

    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].id, 'evt-001');
    assert.strictEqual(events[0].event, 'alert.created');
    assert.deepStrictEqual(events[0].data, {
      id: 'alt-100',
      severity: 'CRITICAL',
    });
    assert.ok(typeof events[0].timestamp === 'string');
  });

  it('parses multi-line data fields and joins them with newlines', async () => {
    const rawPayload = [
      'event: alert.updated\n',
      'id: evt-002\n',
      'data: {\n',
      'data:   "id": "alt-100",\n',
      'data:   "status": "TRIAGED"\n',
      'data: }\n\n',
    ];

    const stream = createChunkedStream(rawPayload);
    const events = [];

    for await (const event of parseSSEStream(stream)) {
      events.push(event);
    }

    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].event, 'alert.updated');
    assert.strictEqual(events[0].id, 'evt-002');
    assert.deepStrictEqual(events[0].data, {
      id: 'alt-100',
      status: 'TRIAGED',
    });
  });

  it('preserves raw string data when payload is not JSON', async () => {
    const sse = 'event: raw.message\ndata: line one\ndata: line two\n\n';
    const stream = createChunkedStream([sse]);
    const events = [];

    for await (const event of parseSSEStream(stream)) {
      events.push(event);
    }

    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].event, 'raw.message');
    assert.strictEqual(events[0].data, 'line one\nline two');
  });

  it('ignores SSE comment lines and keep-alive pings', async () => {
    const sse = [
      ': ping\n',
      ': keep-alive\n\n',
      'event: heartbeat\n',
      'data: {"status": "ok"}\n\n',
      ': trailing ping\n',
    ];

    const stream = createChunkedStream(sse);
    const events = [];

    for await (const event of parseSSEStream(stream)) {
      events.push(event);
    }

    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].event, 'heartbeat');
    assert.deepStrictEqual(events[0].data, { status: 'ok' });
  });

  it('parses retry field and exposes it on event', async () => {
    const sse = 'id: evt-retry\nretry: 4500\nevent: heartbeat\ndata: {}\n\n';
    const stream = createChunkedStream([sse]);
    const events = [];

    for await (const event of parseSSEStream(stream)) {
      events.push(event);
    }

    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].retry, 4500);
    assert.strictEqual(events[0].id, 'evt-retry');
  });

  it('handles CRLF line terminators', async () => {
    const sse = 'event: alert.created\r\nid: crlf-1\r\ndata: {"test": true}\r\n\r\n';
    const stream = createChunkedStream([sse]);
    const events = [];

    for await (const event of parseSSEStream(stream)) {
      events.push(event);
    }

    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].id, 'crlf-1');
    assert.strictEqual(events[0].event, 'alert.created');
    assert.deepStrictEqual(events[0].data, { test: true });
  });
});

describe('Parsing of Event Types', () => {
  it('correctly parses alert.created, alert.updated, and case.opened event taxonomy', async () => {
    const sseStreamText = [
      'event: alert.created\n',
      'id: alt-ev-1\n',
      'data: {"alert_id": "ALT-1", "severity": "CRITICAL", "title": "Suspicious PowerShell"}\n\n',

      'event: alert.updated\n',
      'id: alt-ev-2\n',
      'data: {"alert_id": "ALT-1", "status": "INVESTIGATING", "assignee": "analyst-1"}\n\n',

      'event: case.opened\n',
      'id: case-ev-1\n',
      'data: {"case_id": "CASE-900", "title": "Host Compromise Incident", "alerts": ["ALT-1"]}\n\n',

      'event: heartbeat\n',
      'id: hb-1\n',
      'data: {"timestamp": "2026-09-07T12:00:00Z"}\n\n',
    ];

    const stream = createChunkedStream(sseStreamText);
    const events = [];

    for await (const ev of parseSSEStream(stream)) {
      events.push(ev);
    }

    assert.strictEqual(events.length, 4);

    assert.strictEqual(events[0].event, 'alert.created');
    assert.strictEqual(events[0].id, 'alt-ev-1');
    assert.strictEqual(events[0].data.alert_id, 'ALT-1');
    assert.strictEqual(events[0].data.severity, 'CRITICAL');

    assert.strictEqual(events[1].event, 'alert.updated');
    assert.strictEqual(events[1].id, 'alt-ev-2');
    assert.strictEqual(events[1].data.status, 'INVESTIGATING');

    assert.strictEqual(events[2].event, 'case.opened');
    assert.strictEqual(events[2].id, 'case-ev-1');
    assert.strictEqual(events[2].data.case_id, 'CASE-900');

    assert.strictEqual(events[3].event, 'heartbeat');
    assert.strictEqual(events[3].id, 'hb-1');
  });

  it('defaults event type to message when event field is omitted', async () => {
    const sse = 'id: msg-1\ndata: {"plain": true}\n\n';
    const stream = createChunkedStream([sse]);
    const events = [];

    for await (const ev of parseSSEStream(stream)) {
      events.push(ev);
    }

    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].event, 'message');
    assert.strictEqual(events[0].id, 'msg-1');
  });
});

describe('Async Iteration with AlertStreamSubscription', () => {
  it('supports for await iteration through AlertStreamSubscription', async () => {
    const mockFetch = async () => {
      const sse = [
        'event: alert.created\nid: 1\ndata: {"num": 1}\n\n',
        'event: alert.created\nid: 2\ndata: {"num": 2}\n\n',
        'event: alert.created\nid: 3\ndata: {"num": 3}\n\n',
      ];
      return new Response(createChunkedStream(sse), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    };

    const sub = new AlertStreamSubscription('https://soc.cybrik.io/api/v1/alerts/stream', {
      fetch: mockFetch,
      reconnect: false,
    });

    const received = [];
    for await (const event of sub) {
      received.push(event);
    }

    assert.strictEqual(received.length, 3);
    assert.strictEqual(received[0].id, '1');
    assert.strictEqual(received[1].id, '2');
    assert.strictEqual(received[2].id, '3');
    assert.strictEqual(sub.lastEventId, '3');
  });

  it('cleans up subscription when breaking from for await loop', async () => {
    let streamClosed = false;

    const mockFetch = async () => {
      const readable = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('event: alert.created\nid: 1\ndata: {"count": 1}\n\n'));
          controller.enqueue(new TextEncoder().encode('event: alert.created\nid: 2\ndata: {"count": 2}\n\n'));
          controller.enqueue(new TextEncoder().encode('event: alert.created\nid: 3\ndata: {"count": 3}\n\n'));
        },
        cancel() {
          streamClosed = true;
        },
      });

      return new Response(readable, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    };

    const sub = new AlertStreamSubscription('https://soc.cybrik.io/api/v1/alerts/stream', {
      fetch: mockFetch,
    });

    const events = [];
    for await (const event of sub) {
      events.push(event);
      if (events.length === 2) {
        break; // break early
      }
    }

    assert.strictEqual(events.length, 2);
    assert.strictEqual(sub.isClosed, true);
  });

  it('CybrikClient.subscribeAlerts constructs full URL, query filters, and headers', async () => {
    let capturedUrl = '';
    let capturedHeaders = null;

    const mockFetch = async (url, init) => {
      capturedUrl = url.toString();
      capturedHeaders = init.headers;
      return new Response(createChunkedStream(['event: heartbeat\ndata: {}\n\n']), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    };

    const client = new CybrikClient({
      endpoint: 'https://soc.cybrik.io/core',
      apiToken: 'jwt-stream-token',
      tenantId: 'tenant-stream-99',
      customHeaders: { 'X-Stream-Origin': 'node-runner' },
      fetch: mockFetch,
    });

    const sub = client.subscribeAlerts({
      filter: {
        severity: ['CRITICAL', 'HIGH'],
        status: ['NEW', 'INVESTIGATING'],
        source: ['edr-agent'],
      },
      reconnect: false,
    });

    for await (const ev of sub) {
      assert.strictEqual(ev.event, 'heartbeat');
    }

    assert.ok(capturedUrl.startsWith('https://soc.cybrik.io/core/api/v1/alerts/stream?'));
    const parsedUrl = new URL(capturedUrl);
    assert.strictEqual(parsedUrl.searchParams.get('severity'), 'CRITICAL,HIGH');
    assert.strictEqual(parsedUrl.searchParams.get('status'), 'NEW,INVESTIGATING');
    assert.strictEqual(parsedUrl.searchParams.get('source'), 'edr-agent');

    assert.strictEqual(capturedHeaders['Accept'], 'text/event-stream');
    assert.strictEqual(capturedHeaders['Cache-Control'], 'no-cache');
    assert.strictEqual(capturedHeaders['Authorization'], 'Bearer jwt-stream-token');
    assert.strictEqual(capturedHeaders['X-Tenant-ID'], 'tenant-stream-99');
    assert.strictEqual(capturedHeaders['X-Stream-Origin'], 'node-runner');
  });
});

describe('Clean Cancellation Handling via AbortSignal and Close', () => {
  it('closes stream cleanly when AbortController aborts during iteration', async () => {
    const controller = new AbortController();

    const mockFetch = async (url, init) => {
      const readable = new ReadableStream({
        start(streamController) {
          streamController.enqueue(new TextEncoder().encode('event: alert.created\nid: 1\ndata: {"n": 1}\n\n'));
          // Keep open indefinitely until signal aborts
          init.signal.addEventListener('abort', () => {
            try {
              streamController.close();
            } catch {
              // already closed
            }
          });
        },
      });

      return new Response(readable, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    };

    const sub = new AlertStreamSubscription('https://soc.cybrik.io/api/v1/alerts/stream', {
      fetch: mockFetch,
      signal: controller.signal,
    });

    const received = [];
    for await (const event of sub) {
      received.push(event);
      // Trigger abort on first event
      controller.abort();
    }

    assert.strictEqual(received.length, 1);
    assert.strictEqual(sub.isClosed, true);
    assert.strictEqual(sub.closed, true);
  });

  it('closes stream cleanly when subscription.close() is called', async () => {
    const mockFetch = async (url, init) => {
      const readable = new ReadableStream({
        start(streamController) {
          streamController.enqueue(new TextEncoder().encode('event: alert.created\nid: 1\ndata: {"n": 1}\n\n'));
          init.signal.addEventListener('abort', () => {
            try {
              streamController.close();
            } catch {
              // already closed
            }
          });
        },
      });

      return new Response(readable, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    };

    const sub = new AlertStreamSubscription('https://soc.cybrik.io/api/v1/alerts/stream', {
      fetch: mockFetch,
    });

    const received = [];
    for await (const event of sub) {
      received.push(event);
      sub.close();
    }

    assert.strictEqual(received.length, 1);
    assert.strictEqual(sub.isClosed, true);
  });

  it('exits immediately if initialized with an already-aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();

    let fetchCalled = false;
    const mockFetch = async () => {
      fetchCalled = true;
      return new Response('');
    };

    const sub = new AlertStreamSubscription('https://soc.cybrik.io/api/v1/alerts/stream', {
      fetch: mockFetch,
      signal: controller.signal,
    });

    assert.strictEqual(sub.isClosed, true);

    const received = [];
    for await (const event of sub) {
      received.push(event);
    }

    assert.strictEqual(received.length, 0);
    assert.strictEqual(fetchCalled, false);
  });
});

describe('Reconnection Logic on Network Error', () => {
  it('reconnects automatically on transient network error with exponential backoff and jitter', async () => {
    let attempts = 0;
    const capturedHeaders = [];

    const mockFetch = async (url, init) => {
      attempts++;
      capturedHeaders.push({ ...init.headers });

      if (attempts === 1) {
        // First attempt fails with network disconnect
        throw new Error('ECONNRESET');
      }

      if (attempts === 2) {
        // Second attempt delivers an event and then completes
        return new Response(
          createChunkedStream(['id: reconnected-1\nevent: alert.created\ndata: {"status": "recovered"}\n\n']),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
        );
      }

      return new Response('', { status: 200 });
    };

    const sub = new AlertStreamSubscription('https://soc.cybrik.io/api/v1/alerts/stream', {
      fetch: mockFetch,
      reconnect: true,
      maxReconnectAttempts: 3,
      initialBackoffMs: 10,
      maxBackoffMs: 50,
    });

    const events = [];
    for await (const ev of sub) {
      events.push(ev);
      break; // stop after receiving recovered event
    }

    assert.strictEqual(attempts, 2);
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].id, 'reconnected-1');
    assert.strictEqual(events[0].data.status, 'recovered');
  });

  it('passes Last-Event-ID header upon reconnection', async () => {
    let callCount = 0;
    const headersList = [];

    const mockFetch = async (url, init) => {
      callCount++;
      headersList.push({ ...init.headers });

      if (callCount === 1) {
        // Deliver event with id 999, then stream terminates unexpectedly (server disconnect)
        return new Response(
          createChunkedStream(['id: evt-999\nevent: alert.created\ndata: {"step": 1}\n\n']),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
        );
      }

      if (callCount === 2) {
        // Subsequent reconnect should have Last-Event-ID: evt-999
        return new Response(
          createChunkedStream(['id: evt-1000\nevent: alert.updated\ndata: {"step": 2}\n\n']),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
        );
      }

      return new Response('', { status: 200 });
    };

    const sub = new AlertStreamSubscription('https://soc.cybrik.io/api/v1/alerts/stream', {
      fetch: mockFetch,
      reconnect: true,
      maxReconnectAttempts: 3,
      initialBackoffMs: 10,
      maxBackoffMs: 30,
    });

    const received = [];
    for await (const ev of sub) {
      received.push(ev);
      if (received.length === 2) break;
    }

    assert.strictEqual(received.length, 2);
    assert.strictEqual(callCount, 2);
    assert.strictEqual(headersList[0]['Last-Event-ID'], undefined);
    assert.strictEqual(headersList[1]['Last-Event-ID'], 'evt-999');
  });

  it('throws CybrikSDKError with STREAM_RECONNECT_EXCEEDED when maxReconnectAttempts is exceeded', async () => {
    let callCount = 0;

    const mockFetch = async () => {
      callCount++;
      throw new Error('Connection refused: 127.0.0.1:8080');
    };

    const sub = new AlertStreamSubscription('https://soc.cybrik.io/api/v1/alerts/stream', {
      fetch: mockFetch,
      reconnect: true,
      maxReconnectAttempts: 2,
      initialBackoffMs: 5,
      maxBackoffMs: 20,
    });

    await assert.rejects(
      async () => {
        for await (const _ of sub) {
          // should not yield
        }
      },
      (err) => {
        return (
          err instanceof CybrikSDKError &&
          err.code === 'STREAM_RECONNECT_EXCEEDED' &&
          err.message.includes('Max reconnection attempts (2) exceeded')
        );
      }
    );

    assert.strictEqual(callCount, 3); // initial + 2 retries = 3
  });

  it('fails immediately without reconnecting when reconnect: false', async () => {
    let callCount = 0;

    const mockFetch = async () => {
      callCount++;
      throw new Error('Network offline');
    };

    const sub = new AlertStreamSubscription('https://soc.cybrik.io/api/v1/alerts/stream', {
      fetch: mockFetch,
      reconnect: false,
    });

    await assert.rejects(
      async () => {
        for await (const _ of sub) {
          // unreachable
        }
      },
      (err) => err instanceof Error && err.message === 'Network offline'
    );

    assert.strictEqual(callCount, 1);
  });

  it('fails immediately on HTTP 401 without reconnecting', async () => {
    let callCount = 0;

    const mockFetch = async () => {
      callCount++;
      return new Response('Invalid token', { status: 401 });
    };

    const sub = new AlertStreamSubscription('https://soc.cybrik.io/api/v1/alerts/stream', {
      fetch: mockFetch,
      reconnect: true,
      maxReconnectAttempts: 5,
    });

    await assert.rejects(
      async () => {
        for await (const _ of sub) {
          // unreachable
        }
      },
      (err) => err instanceof CybrikAuthenticationError
    );

    assert.strictEqual(callCount, 1);
  });

  it('calculateBackoff respects minimum, maximum, and jitter bounds', () => {
    const b1 = calculateBackoff(1, 1000, 30000);
    assert.ok(b1 >= 800 && b1 <= 1200, `b1 out of expected jitter bounds: ${b1}`);

    const b2 = calculateBackoff(2, 1000, 30000);
    assert.ok(b2 >= 1600 && b2 <= 2400, `b2 out of expected jitter bounds: ${b2}`);

    const bLarge = calculateBackoff(10, 1000, 30000);
    assert.ok(bLarge >= 24000 && bLarge <= 30000, `bLarge out of expected bounds: ${bLarge}`);
  });
});
