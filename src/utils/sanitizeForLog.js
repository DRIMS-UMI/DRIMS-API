/**
 * sanitizeForLog
 *
 * Strips sensitive fields from any object or array of objects before
 * it is serialized into an activity log. Works recursively so nested
 * objects (e.g. oldValue / newValue inside a changes array) are also
 * scrubbed.
 *
 * Add any field names that should NEVER appear in audit logs to the
 * SENSITIVE_FIELDS set below.
 */

const SENSITIVE_FIELDS = new Set([
  'password',
  'passwordHash',
  'hashedPassword',
  'hash',
  'salt',
  'token',
  'refreshToken',
  'accessToken',
  'secret',
  'apiKey',
  'privateKey',
  'creditCard',
  'cardNumber',
  'cvv',
  'pin',
]);

/**
 * Recursively remove sensitive keys from a value.
 * @param {*} value - Any JSON-serializable value
 * @returns {*} - The sanitized value
 */
function sanitizeValue(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value !== null && typeof value === 'object') {
    const sanitized = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_FIELDS.has(key.toLowerCase()) || SENSITIVE_FIELDS.has(key)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeValue(val);
      }
    }
    return sanitized;
  }

  return value;
}

/**
 * Sanitize an object / array and return a JSON string safe for logging.
 * @param {*} data - The data to serialize
 * @returns {string} - JSON string with sensitive fields replaced by "[REDACTED]"
 */
export function sanitizeForLog(data) {
  return JSON.stringify(sanitizeValue(data));
}
