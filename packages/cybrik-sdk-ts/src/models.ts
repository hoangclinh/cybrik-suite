/**
 * Severity ranking for security detection alerts.
 */
export type AlertSeverity =
  | 'CRITICAL'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'INFORMATIONAL';

/**
 * Authoritative investigation lifecycle status of an alert.
 */
export type AlertStatus =
  | 'NEW'
  | 'TRIAGED'
  | 'INVESTIGATING'
  | 'CONTAINED'
  | 'RESOLVED'
  | 'CLOSED';

/**
 * Authoritative security alert model.
 */
export interface Alert {
  alert_id: string;
  title: string;
  severity: AlertSeverity;
  status: AlertStatus;
  created_at: string;
  description?: string;
  source?: string;
  tenant_id?: string;
  labels?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

/**
 * Batch container for security event ingestion.
 */
export interface AlertBatch {
  events: Array<Record<string, unknown>>;
  tenant_id?: string;
}

/**
 * Response returned after batch event ingestion.
 */
export interface IngestResponse {
  accepted: boolean;
  count: number;
  batch_id: string;
  errors?: string[];
}

/**
 * Platform and service health status report.
 */
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

/**
 * Configuration options for initializing CybrikClient.
 */
export interface CybrikClientOptions {
  endpoint: string;
  apiToken?: string;
  tenantId?: string;
  timeoutMs?: number;
  customHeaders?: Record<string, string>;
  fetch?: typeof fetch;
}

/**
 * Query options for filtering and paginating alerts list.
 */
export interface ListAlertsOptions {
  status?: AlertStatus;
  limit?: number;
  offset?: number;
}
