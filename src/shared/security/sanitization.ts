// src/shared/security/sanitization.ts

/**
 * Sanitizes string input to prevent XSS and injection attacks
 */
export function sanitizeString(input: string, maxLength = 10000): string {
  if (typeof input !== 'string') {
    return ''
  }

  // Remove null bytes
  let sanitized = input.replace(/\0/g, '')

  // Truncate to max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength)
  }

  return sanitized
}

/**
 * Sanitizes HTML content (basic)
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Validates and sanitizes data URL
 */
export function sanitizeDataUrl(dataUrl: string): { valid: boolean; sanitized?: string; error?: string } {
  if (!dataUrl || typeof dataUrl !== 'string') {
    return { valid: false, error: 'Data URL must be a non-empty string' }
  }

  // Check format: data:[<mediatype>][;base64],<data>
  const dataUrlPattern = /^data:([a-zA-Z][a-zA-Z0-9]*\/[a-zA-Z0-9][a-zA-Z0-9]*)(;base64)?,/
  
  if (!dataUrlPattern.test(dataUrl)) {
    return { valid: false, error: 'Invalid data URL format' }
  }

  // Limit size (10MB)
  const maxSize = 10 * 1024 * 1024
  if (dataUrl.length > maxSize) {
    return { valid: false, error: 'Data URL exceeds maximum size of 10MB' }
  }

  return { valid: true, sanitized: dataUrl }
}

/**
 * Validates UUID format
 */
export function validateUuid(uuid: string): boolean {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidPattern.test(uuid)
}

/**
 * Validates hex color
 */
export function validateHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color)
}
