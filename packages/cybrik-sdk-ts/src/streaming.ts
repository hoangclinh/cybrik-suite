import {
  CybrikAuthenticationError,
  CybrikAuthorizationError,
  CybrikNotFoundError,
  CybrikRateLimitError,
  CybrikSDKError,
  CybrikServerError,
} from './errors.js';

/**
 * Semantic classification of real-time streaming events.
 */
export type StreamEventType =
  | 'alert.created'
  | 'alert.updated'
  | 'case.opened'
  | 'heartbeat'
  | string;

/**
 * Server-Sent Event (SSE) model representing an event delivered over the real-time channel.
 */
export interface StreamEvent<T = any> {
  id: string;
  event: StreamEventType;
  data: T;
  timestamp?: string;
  retry?: number;
}

/**
 * Configuration options for subscribing to real-time event streams.
 */
export interface StreamSubscriptionOptions {
  filter?: {
    severity?: string[];
    status?: string[];
    source?: string[];
  };
  signal?: AbortSignal;
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}

export const DEFAULT_STREAM_RECONNECT = true;
export const DEFAULT_MAX_RECONNECT_ATTEMPTS = 5;
export const DEFAULT_INITIAL_BACKOFF_MS = 1000;
export const DEFAULT_MAX_BACKOFF_MS = 30000;

/**
 * Calculate exponential backoff duration with jitter.
 */
export function calculateBackoff(
  attempt: number,
  initialBackoffMs: number = DEFAULT_INITIAL_BACKOFF_MS,
  maxBackoffMs: number = DEFAULT_MAX_BACKOFF_MS,
  serverRetryMs?: number
): number {
  const base = (serverRetryMs ?? initialBackoffMs) * Math.pow(2, Math.max(0, attempt - 1));
  const clamped = Math.min(maxBackoffMs, base);
  // Full jitter: uniformly distributed between 80% and 120% of base
  const jitterFactor = 0.8 + Math.random() * 0.4;
  return Math.min(maxBackoffMs, Math.max(1, Math.round(clamped * jitterFactor)));
}

/**
 * Asynchronous generator parsing SSE chunks into StreamEvent objects.
 * Handles chunked byte or text streams, multi-line data fields, custom event types,
 * id tracking, and retry declarations.
 */
export async function* parseSSEStream<T = any>(
  source: AsyncIterable<Uint8Array | string> | ReadableStream<Uint8Array> | Array<Uint8Array | string>,
  options?: { signal?: AbortSignal }
): AsyncGenerator<StreamEvent<T>, void, unknown> {
  let buffer = '';
  const textDecoder = new TextDecoder('utf-8');

  let currentEventType: StreamEventType = '';
  let currentId = '';
  let lastEventId = '';
  let dataLines: string[] = [];
  let hasData = false;
  let currentRetry: number | undefined;

  const dispatch = (): StreamEvent<T> | null => {
    if (!hasData && !currentEventType && !currentId) {
      return null;
    }

    const rawData = dataLines.join('\n');
    let parsedData: any = rawData;
    if (hasData && rawData.trim() !== '') {
      try {
        parsedData = JSON.parse(rawData);
      } catch {
        parsedData = rawData;
      }
    }

    const event: StreamEvent<T> = {
      id: currentId || lastEventId || '',
      event: currentEventType || 'message',
      data: parsedData,
      timestamp: new Date().toISOString(),
    };

    if (currentRetry !== undefined) {
      event.retry = currentRetry;
    }

    // Reset current event accumulator fields
    currentEventType = '';
    currentId = '';
    dataLines = [];
    hasData = false;
    currentRetry = undefined;

    return event;
  };

  const processLine = (line: string): StreamEvent<T> | null => {
    if (line.length === 0) {
      return dispatch();
    }

    if (line.startsWith(':')) {
      // Ignore SSE comment lines
      return null;
    }

    let field: string;
    let value: string;
    const colonIdx = line.indexOf(':');
    if (colonIdx >= 0) {
      field = line.slice(0, colonIdx);
      value = line.slice(colonIdx + 1);
      if (value.startsWith(' ')) {
        value = value.slice(1);
      }
    } else {
      field = line;
      value = '';
    }

    switch (field) {
      case 'event':
        currentEventType = value as StreamEventType;
        break;
      case 'data':
        hasData = true;
        dataLines.push(value);
        break;
      case 'id':
        if (!value.includes('\0')) {
          currentId = value;
          lastEventId = value;
        }
        break;
      case 'retry': {
        const parsed = parseInt(value.trim(), 10);
        if (!isNaN(parsed) && parsed >= 0) {
          currentRetry = parsed;
        }
        break;
      }
    }

    return null;
  };

  const extractLines = (chunkText: string): string[] => {
    buffer += chunkText;
    const lines: string[] = [];
    let i = 0;
    while (i < buffer.length) {
      if (buffer[i] === '\r') {
        if (i + 1 < buffer.length) {
          if (buffer[i + 1] === '\n') {
            lines.push(buffer.slice(0, i));
            buffer = buffer.slice(i + 2);
            i = 0;
            continue;
          } else {
            lines.push(buffer.slice(0, i));
            buffer = buffer.slice(i + 1);
            i = 0;
            continue;
          }
        } else {
          // Trailing \r at the buffer boundary, await next chunk
          break;
        }
      } else if (buffer[i] === '\n') {
        lines.push(buffer.slice(0, i));
        buffer = buffer.slice(i + 1);
        i = 0;
        continue;
      }
      i++;
    }
    return lines;
  };

  const toChunkText = (chunk: unknown): string => {
    if (typeof chunk === 'string') return chunk;
    if (chunk instanceof Uint8Array) {
      return textDecoder.decode(chunk, { stream: true });
    }
    if (chunk && typeof (chunk as { toString: (enc?: string) => string }).toString === 'function') {
      return (chunk as { toString: (enc?: string) => string }).toString('utf-8');
    }
    return String(chunk ?? '');
  };

  const chunkIterator = async function* () {
    if (source && typeof (source as any)[Symbol.asyncIterator] === 'function') {
      for await (const chunk of source as any) {
        yield chunk;
      }
    } else if (source && typeof (source as any).getReader === 'function') {
      const reader = (source as any).getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          yield value;
        }
      } finally {
        reader.releaseLock?.();
      }
    } else if (Array.isArray(source)) {
      for (const item of source) {
        yield item;
      }
    } else {
      throw new CybrikSDKError('Invalid stream source provided to parseSSEStream', 'STREAM_ERROR');
    }
  };

  for await (const chunk of chunkIterator()) {
    if (options?.signal?.aborted) {
      return;
    }
    const chunkText = toChunkText(chunk);
    const lines = extractLines(chunkText);
    for (const line of lines) {
      const ev = processLine(line);
      if (ev) {
        yield ev;
      }
    }
  }

  const finalRemaining = textDecoder.decode();
  if (finalRemaining) {
    const lines = extractLines(finalRemaining);
    for (const line of lines) {
      const ev = processLine(line);
      if (ev) {
        yield ev;
      }
    }
  }

  if (buffer.length > 0) {
    let lastLine = buffer;
    if (lastLine.endsWith('\r')) {
      lastLine = lastLine.slice(0, -1);
    }
    buffer = '';
    const ev = processLine(lastLine);
    if (ev) {
      yield ev;
    }
  }

  const trailingEvent = dispatch();
  if (trailingEvent) {
    yield trailingEvent;
  }
}

/**
 * Real-time SSE alert event stream subscription manager.
 * Implements AsyncIterable<StreamEvent> with automatic reconnect, backoff jitter,
 * and clean cancellation handling.
 */
export class AlertStreamSubscription implements AsyncIterable<StreamEvent> {
  readonly url: string;
  readonly options: StreamSubscriptionOptions;
  private readonly headers: Record<string, string>;
  private readonly fetchFn: typeof fetch;
  private _closed = false;
  private readonly abortController: AbortController;
  private _lastEventId = '';
  private _reconnectAttempts = 0;
  private _serverRetryMs?: number;

  constructor(
    url: string,
    options: StreamSubscriptionOptions = {}
  ) {
    this.url = url;
    this.options = options;
    this.headers = options.headers ? { ...options.headers } : {};
    this.fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.abortController = new AbortController();

    if (options.signal) {
      if (options.signal.aborted) {
        this.close();
      } else {
        options.signal.addEventListener('abort', () => this.close(), { once: true });
      }
    }
  }

  get closed(): boolean {
    return this._closed;
  }

  get isClosed(): boolean {
    return this._closed;
  }

  get lastEventId(): string {
    return this._lastEventId;
  }

  get reconnectAttempts(): number {
    return this._reconnectAttempts;
  }

  close(): void {
    if (this._closed) return;
    this._closed = true;
    this.abortController.abort();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this._closed || this.abortController.signal.aborted) {
        resolve();
        return;
      }
      const onAbort = () => {
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        this.abortController.signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      this.abortController.signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  private async handleHttpError(response: Response): Promise<never> {
    const status = response.status;
    let body: string | undefined;
    try {
      body = await response.text();
    } catch {
      body = undefined;
    }

    if (status === 401) {
      throw new CybrikAuthenticationError(
        `Authentication failed (HTTP 401): ${body || 'Unauthorized'}`,
        body
      );
    }
    if (status === 403) {
      throw new CybrikAuthorizationError(
        `Authorization failed (HTTP 403): ${body || 'Forbidden'}`,
        body
      );
    }
    if (status === 404) {
      throw new CybrikNotFoundError(
        `Streaming endpoint not found (HTTP 404): ${body || 'Not Found'}`,
        body
      );
    }
    if (status === 429) {
      let retryAfterSeconds: number | undefined;
      const retryHeader = response.headers.get('Retry-After');
      if (retryHeader) {
        const sec = parseInt(retryHeader, 10);
        if (!isNaN(sec)) {
          retryAfterSeconds = sec;
        }
      }
      throw new CybrikRateLimitError(
        `Rate limit exceeded (HTTP 429): ${body || 'Too Many Requests'}`,
        retryAfterSeconds,
        body
      );
    }
    if (status >= 500 && status < 600) {
      throw new CybrikServerError(
        `Server error on stream (HTTP ${status}): ${body || 'Internal Server Error'}`,
        status,
        body
      );
    }
    throw new CybrikSDKError(
      `Streaming request failed with status ${status}: ${body || response.statusText}`,
      `HTTP_${status}`,
      status,
      body
    );
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<StreamEvent, void, unknown> {
    const reconnect = this.options.reconnect ?? DEFAULT_STREAM_RECONNECT;
    const maxReconnectAttempts = this.options.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS;
    const initialBackoffMs = this.options.initialBackoffMs ?? DEFAULT_INITIAL_BACKOFF_MS;
    const maxBackoffMs = this.options.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;

    try {
      while (!this._closed && !this.abortController.signal.aborted) {
        let eventsReceivedOnConnection = 0;
        let streamFailedWithError: unknown = null;

        try {
          const reqHeaders: Record<string, string> = {
            Accept: 'text/event-stream',
            'Cache-Control': 'no-cache',
            ...this.headers,
          };
          if (this._lastEventId) {
            reqHeaders['Last-Event-ID'] = this._lastEventId;
          }

          const response = await this.fetchFn(this.url, {
            method: 'GET',
            headers: reqHeaders,
            signal: this.abortController.signal,
          });

          if (!response.ok) {
            await this.handleHttpError(response);
          }

          const body = response.body;
          if (!body) {
            throw new CybrikSDKError('Response body is missing', 'STREAM_ERROR', response.status);
          }

          for await (const event of parseSSEStream(body, { signal: this.abortController.signal })) {
            eventsReceivedOnConnection++;
            this._reconnectAttempts = 0;
            if (event.id) {
              this._lastEventId = event.id;
            }
            if (event.retry !== undefined) {
              this._serverRetryMs = event.retry;
            }
            yield event;
          }
        } catch (err: unknown) {
          if (this._closed || this.abortController.signal.aborted) {
            return;
          }
          if (
            err instanceof CybrikAuthenticationError ||
            err instanceof CybrikAuthorizationError ||
            err instanceof CybrikNotFoundError
          ) {
            throw err;
          }
          streamFailedWithError = err;
        }

        if (this._closed || this.abortController.signal.aborted) {
          return;
        }

        if (!reconnect) {
          if (streamFailedWithError) {
            throw streamFailedWithError;
          }
          return;
        }

        this._reconnectAttempts++;
        if (this._reconnectAttempts > maxReconnectAttempts) {
          const baseMsg =
            streamFailedWithError instanceof Error
              ? streamFailedWithError.message
              : String(streamFailedWithError || 'Server closed connection');
          throw new CybrikSDKError(
            `Max reconnection attempts (${maxReconnectAttempts}) exceeded: ${baseMsg}`,
            'STREAM_RECONNECT_EXCEEDED'
          );
        }

        const backoffDelay = calculateBackoff(
          this._reconnectAttempts,
          initialBackoffMs,
          maxBackoffMs,
          this._serverRetryMs
        );

        await this.sleep(backoffDelay);
      }
    } finally {
      this.close();
    }
  }
}
