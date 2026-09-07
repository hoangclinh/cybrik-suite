import {
  CybrikAuthenticationError,
  CybrikAuthorizationError,
  CybrikNotFoundError,
  CybrikRateLimitError,
  CybrikSDKError,
  CybrikServerError,
  CybrikTimeoutError,
} from './errors.js';
import type {
  Alert,
  AlertStatus,
  CybrikClientOptions,
  IngestResponse,
  ListAlertsOptions,
  SystemHealth,
} from './models.js';
import { AlertStreamSubscription } from './streaming.js';
import type { StreamSubscriptionOptions } from './streaming.js';

export const SDK_VERSION = '0.1.0';
export const DEFAULT_USER_AGENT = 'cybrik-sdk-ts/0.1.0';
export const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Official TypeScript / Node.js client for the CYBRIK Autonomous Cyber Defense Platform.
 */
export class CybrikClient {
  readonly endpoint: string;
  readonly apiToken?: string;
  readonly tenantId?: string;
  readonly timeoutMs: number;
  readonly customHeaders: Record<string, string>;
  private readonly fetchFn: typeof fetch;

  constructor(options: CybrikClientOptions) {
    if (!options || typeof options.endpoint !== 'string' || options.endpoint.trim() === '') {
      throw new CybrikSDKError('CybrikClient requires a valid non-empty endpoint URL', 'INVALID_CONFIG');
    }

    this.endpoint = options.endpoint.trim().replace(/\/+$/, '');
    this.apiToken = options.apiToken;
    this.tenantId = options.tenantId;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.customHeaders = options.customHeaders ? { ...options.customHeaders } : {};
    this.fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * Internal request dispatcher subject to timeout, header injection, and error status mapping.
   */
  private async request<T>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
    body?: unknown,
    params?: Record<string, string | number | undefined>
  ): Promise<T> {
    let url = `${this.endpoint}${path.startsWith('/') ? path : `/${path}`}`;

    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          searchParams.set(key, String(value));
        }
      }
      const qs = searchParams.toString();
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs;
      }
    }

    const headers: Record<string, string> = {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'application/json',
      ...this.customHeaders,
    };

    if (this.apiToken) {
      headers['Authorization'] = `Bearer ${this.apiToken}`;
    }

    if (this.tenantId) {
      headers['X-Tenant-ID'] = this.tenantId;
    }

    let serializedBody: string | undefined;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      serializedBody = JSON.stringify(body);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method,
        headers,
        body: serializedBody,
        signal: controller.signal,
      });
    } catch (err: unknown) {
      if (
        (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) ||
        controller.signal.aborted
      ) {
        throw new CybrikTimeoutError(`Request timed out after ${this.timeoutMs}ms`);
      }
      throw new CybrikSDKError(
        `Network request failed: ${err instanceof Error ? err.message : String(err)}`,
        'NETWORK_ERROR'
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    // 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    try {
      return (await response.json()) as T;
    } catch (parseErr: unknown) {
      throw new CybrikSDKError(
        `Failed to decode JSON response: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
        'DECODE_ERROR',
        response.status
      );
    }
  }

  /**
   * Parse error responses and throw the corresponding typed SDK error.
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    const status = response.status;
    let responseBody: string | undefined;

    try {
      responseBody = await response.text();
    } catch {
      responseBody = undefined;
    }

    if (status === 401) {
      throw new CybrikAuthenticationError(
        `Authentication failed (HTTP 401): ${responseBody || 'Unauthorized'}`,
        responseBody
      );
    }

    if (status === 403) {
      throw new CybrikAuthorizationError(
        `Authorization failed (HTTP 403): ${responseBody || 'Forbidden'}`,
        responseBody
      );
    }

    if (status === 404) {
      throw new CybrikNotFoundError(
        `Resource not found (HTTP 404): ${responseBody || 'Not Found'}`,
        responseBody
      );
    }

    if (status === 429) {
      let retryAfterSeconds: number | undefined;
      const retryHeader = response.headers.get('Retry-After');
      if (retryHeader) {
        const parsedSec = parseInt(retryHeader, 10);
        if (!isNaN(parsedSec)) {
          retryAfterSeconds = parsedSec;
        } else {
          const parsedDate = Date.parse(retryHeader);
          if (!isNaN(parsedDate)) {
            retryAfterSeconds = Math.max(0, Math.ceil((parsedDate - Date.now()) / 1000));
          }
        }
      }
      throw new CybrikRateLimitError(
        `Rate limit exceeded (HTTP 429): ${responseBody || 'Too Many Requests'}`,
        retryAfterSeconds,
        responseBody
      );
    }

    if (status >= 500 && status < 600) {
      throw new CybrikServerError(
        `Server error (HTTP ${status}): ${responseBody || 'Internal Server Error'}`,
        status,
        responseBody
      );
    }

    throw new CybrikSDKError(
      `API request failed with status ${status}: ${responseBody || response.statusText}`,
      `HTTP_${status}`,
      status,
      responseBody
    );
  }

  /**
   * Check platform and service health status.
   */
  async getHealth(): Promise<SystemHealth> {
    return this.request<SystemHealth>('/health', 'GET');
  }

  /**
   * Ingest a batch of security event records into the CYBRIK detection pipeline.
   */
  async ingestEvents(events: Array<Record<string, unknown>>): Promise<IngestResponse> {
    const payload: { events: Array<Record<string, unknown>>; tenant_id?: string } = {
      events,
    };
    if (this.tenantId) {
      payload.tenant_id = this.tenantId;
    }
    return this.request<IngestResponse>('/events', 'POST', payload);
  }

  /**
   * Retrieve an authoritative security alert record by ID.
   */
  async getAlert(alertId: string): Promise<Alert> {
    if (!alertId || typeof alertId !== 'string' || alertId.trim() === '') {
      throw new CybrikSDKError('alertId must be a non-empty string', 'INVALID_ARGUMENT');
    }
    return this.request<Alert>(`/alerts/${encodeURIComponent(alertId.trim())}`, 'GET');
  }

  /**
   * List security alerts with optional filtering and pagination.
   */
  async listAlerts(options?: ListAlertsOptions): Promise<Alert[]> {
    const params: Record<string, string | number | undefined> = {
      status: options?.status,
      limit: options?.limit,
      offset: options?.offset,
    };

    const res = await this.request<Alert[] | { alerts?: Alert[]; items?: Alert[] }>('/alerts', 'GET', undefined, params);

    if (Array.isArray(res)) {
      return res;
    }

    if (res && typeof res === 'object') {
      if (Array.isArray(res.alerts)) {
        return res.alerts;
      }
      if (Array.isArray(res.items)) {
        return res.items;
      }
    }

    return [];
  }

  /**
   * Subscribe to real-time security alert events via Server-Sent Events (SSE).
   */
  subscribeAlerts(options?: StreamSubscriptionOptions): AlertStreamSubscription {
    let url = `${this.endpoint}/api/v1/alerts/stream`;

    if (options?.filter) {
      const searchParams = new URLSearchParams();
      if (options.filter.severity && options.filter.severity.length > 0) {
        searchParams.set(
          'severity',
          Array.isArray(options.filter.severity)
            ? options.filter.severity.join(',')
            : String(options.filter.severity)
        );
      }
      if (options.filter.status && options.filter.status.length > 0) {
        searchParams.set(
          'status',
          Array.isArray(options.filter.status)
            ? options.filter.status.join(',')
            : String(options.filter.status)
        );
      }
      if (options.filter.source && options.filter.source.length > 0) {
        searchParams.set(
          'source',
          Array.isArray(options.filter.source)
            ? options.filter.source.join(',')
            : String(options.filter.source)
        );
      }
      const qs = searchParams.toString();
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs;
      }
    }

    const headers: Record<string, string> = {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
      ...this.customHeaders,
    };

    if (this.apiToken) {
      headers['Authorization'] = `Bearer ${this.apiToken}`;
    }

    if (this.tenantId) {
      headers['X-Tenant-ID'] = this.tenantId;
    }

    return new AlertStreamSubscription(url, {
      ...options,
      headers: { ...headers, ...options?.headers },
      fetch: options?.fetch ?? this.fetchFn,
    });
  }
}
