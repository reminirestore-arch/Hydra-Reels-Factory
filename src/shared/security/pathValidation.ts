// src/shared/security/pathValidation.ts
import { resolve, normalize, dirname, basename, extname } from 'path'
import { getConfig } from '../config'

/**
 * Validates and sanitizes file paths to prevent directory traversal attacks
 */
export class PathValidator {
  private readonly maxLength: number
  private readonly allowedExtensions: string[]

  constructor() {
    const config = getConfig()
    this.maxLength = config.paths.maxPathLength
    this.allowedExtensions = config.paths.allowedExtensions
  }

  /**
   * Validates if a path is safe and within allowed constraints
   */
  validatePath(
    path: string,
    baseDir?: string
  ): { valid: boolean; error?: string; sanitized?: string } {
    if (!path || typeof path !== 'string') {
      return { valid: false, error: 'Path must be a non-empty string' }
    }

    // Check length
    if (path.length > this.maxLength) {
      return { valid: false, error: `Path exceeds maximum length of ${this.maxLength}` }
    }

    // Normalize path
    const normalized = normalize(path)

    // Check for dangerous patterns
    if (normalized.includes('..')) {
      return { valid: false, error: 'Path contains directory traversal (..)' }
    }

    if (normalized.includes('\0')) {
      return { valid: false, error: 'Path contains null bytes' }
    }

    // If baseDir is provided, ensure path is within it
    if (baseDir) {
      const resolved = resolve(baseDir, normalized)
      const baseResolved = resolve(baseDir)

      if (!resolved.startsWith(baseResolved)) {
        return { valid: false, error: 'Path is outside of base directory' }
      }
    }

    return { valid: true, sanitized: normalized }
  }

  /**
   * Validates file extension
   */
  validateExtension(filePath: string): { valid: boolean; error?: string } {
    const ext = extname(filePath).toLowerCase()

    if (!this.allowedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `Extension ${ext} is not allowed. Allowed: ${this.allowedExtensions.join(', ')}`
      }
    }

    return { valid: true }
  }

  /**
   * Sanitizes filename by removing dangerous characters
   */
  sanitizeFilename(filename: string): string {
    // Remove path separators and dangerous characters
    // Using character code checks to avoid linter errors with control characters in regex
    const dangerousChars = /[<>:"/\\|?*]/g
    const sanitized = basename(filename)
      .replace(dangerousChars, '_')
      .replace(/\s+/g, '_')
      .split('')
      .map((char) => {
        const code = char.charCodeAt(0)
        // Replace control characters (0x00-0x1F) with underscore
        return code >= 0 && code <= 31 ? '_' : char
      })
      .join('')
    return sanitized.slice(0, 255) // Max filename length on most systems
  }

  /**
   * Validates and sanitizes a full file path
   */
  validateAndSanitize(
    filePath: string,
    baseDir?: string
  ): {
    valid: boolean
    error?: string
    sanitized?: string
  } {
    const pathValidation = this.validatePath(filePath, baseDir)
    if (!pathValidation.valid) {
      return pathValidation
    }

    const extValidation = this.validateExtension(filePath)
    if (!extValidation.valid) {
      return extValidation
    }

    const sanitized = this.sanitizeFilename(basename(filePath))
    const dir = dirname(pathValidation.sanitized!)

    return {
      valid: true,
      sanitized: resolve(dir, sanitized)
    }
  }
}

export const pathValidator = new PathValidator()
