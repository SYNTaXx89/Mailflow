/**
 * Security utility functions for data sanitization and logging
 */

/**
 * Redact sensitive fields from an object for safe logging
 * @param obj - The object to redact sensitive fields from
 * @returns A new object with sensitive fields redacted
 */
export function redactSensitiveFields(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const redacted = { ...obj };
  
  // List of sensitive field names to redact
  const sensitiveFields = [
    'password',
    'confirmPassword', 
    'currentPassword',
    'newPassword',
    'oldPassword',
    'passwordHash',
    'pass',
    'secret',
    'token',
    'apiKey',
    'api_key'
  ];

  sensitiveFields.forEach(field => {
    if (redacted[field]) {
      redacted[field] = '[REDACTED]';
    }
  });

  return redacted;
}

/**
 * Safely log an object by redacting sensitive fields
 * @param label - Label for the log entry
 * @param obj - Object to log
 */
export function safeLog(label: string, obj: any): void {
  console.log(label, redactSensitiveFields(obj));
}