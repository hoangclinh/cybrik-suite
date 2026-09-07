/**
 * Base error class for all CYBRIK SDK errors.
 */
export class CybrikSDKError extends Error {
  readonly code: string;
  readonly statusCode?: number;
  readonly responseBody?: string;

  constructor(
    message: string,
    code: string = 'SDK_ERROR',
    statusCode?: number,
    responseBody?: string
  ) {
    super(message);
    this.name = 'CybrikSDKError';
    this.code = code;
    this.statusCode = statusCode;
    this.responseBody = responseBody;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an HTTP 401 Unauthorized response is received.
 */
export class CybrikAuthenticationError extends CybrikSDKError {
  constructor(
    message: string = 'Authentication failed: invalid or missing API token',
    responseBody?: string
  ) {
    super(message, 'AUTHENTICATION_ERROR', 401, responseBody);
    this.name = 'CybrikAuthenticationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an HTTP 403 Forbidden response is received.
 */
export class CybrikAuthorizationError extends CybrikSDKError {
  constructor(
    message: string = 'Authorization failed: insufficient permissions for resource',
    responseBody?: string
  ) {
    super(message, 'AUTHORIZATION_ERROR', 403, responseBody);
    this.name = 'CybrikAuthorizationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an HTTP 404 Not Found response is received.
 */
export class CybrikNotFoundError extends CybrikSDKError {
  constructor(
    message: string = 'Requested resource was not found',
    responseBody?: string
  ) {
    super(message, 'NOT_FOUND_ERROR', 404, responseBody);
    this.name = 'CybrikNotFoundError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an HTTP 429 Too Many Requests response is received.
 */
export class CybrikRateLimitError extends CybrikSDKError {
  readonly retryAfterSeconds?: number;

  constructor(
    message: string = 'Rate limit exceeded; request throttled by CYBRIK API',
    retryAfterSeconds?: number,
    responseBody?: string
  ) {
    super(message, 'RATE_LIMIT_ERROR', 429, responseBody);
    this.name = 'CybrikRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an HTTP 5xx Server Error response is received.
 */
export class CybrikServerError extends CybrikSDKError {
  constructor(
    message: string = 'Internal server error returned by CYBRIK API',
    statusCode: number = 500,
    responseBody?: string
  ) {
    super(message, 'SERVER_ERROR', statusCode, responseBody);
    this.name = 'CybrikServerError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a client request exceeds the configured timeout duration.
 */
export class CybrikTimeoutError extends CybrikSDKError {
  constructor(message: string = 'Request timed out waiting for response') {
    super(message, 'TIMEOUT_ERROR');
    this.name = 'CybrikTimeoutError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
