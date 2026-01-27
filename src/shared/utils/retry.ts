// src/shared/utils/retry.ts
import { createLogger } from '../logger'

const logger = createLogger('Retry')

export interface RetryOptions {
  maxAttempts?: number
  delay?: number
  backoff?: 'linear' | 'exponential'
  onRetry?: (attempt: number, error: Error) => void
}

/**
 * Retries a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3
  const baseDelay = options.delay ?? 1000
  const backoff = options.backoff ?? 'exponential'

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt === maxAttempts) {
        logger.error(`All ${maxAttempts} retry attempts failed`, lastError)
        throw lastError
      }

      const delay = backoff === 'exponential' 
        ? baseDelay * Math.pow(2, attempt - 1)
        : baseDelay * attempt

      logger.warn(`Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms`, {
        error: lastError.message
      })

      if (options.onRetry) {
        options.onRetry(attempt, lastError)
      }

      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError || new Error('Retry failed')
}
