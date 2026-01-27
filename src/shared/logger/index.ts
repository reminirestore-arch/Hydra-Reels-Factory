// src/shared/logger/index.ts
type LogLevel = 'error' | 'warn' | 'info' | 'debug'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: number
  context?: Record<string, unknown>
  error?: Error
}

class Logger {
  private level: LogLevel
  private logs: LogEntry[] = []
  private maxLogs: number

  constructor(level: LogLevel = 'info', maxLogs: number = 1000) {
    this.level = level
    this.maxLogs = maxLogs
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['error', 'warn', 'info', 'debug']
    return levels.indexOf(level) <= levels.indexOf(this.level)
  }

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): void {
    if (!this.shouldLog(level)) return

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context,
      error
    }

    this.logs.push(entry)
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    // Console output with formatting
    const prefix = `[${new Date(entry.timestamp).toISOString()}] [${level.toUpperCase()}]`
    const contextStr = context ? ` ${JSON.stringify(context)}` : ''
    const errorStr = error ? `\n${error.stack}` : ''

    switch (level) {
      case 'error':
        console.error(`${prefix} ${message}${contextStr}${errorStr}`)
        break
      case 'warn':
        console.warn(`${prefix} ${message}${contextStr}`)
        break
      case 'info':
        console.info(`${prefix} ${message}${contextStr}`)
        break
      case 'debug':
        console.debug(`${prefix} ${message}${contextStr}`)
        break
    }
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('error', message, context, error)
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context)
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context)
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context)
  }

  getLogs(level?: LogLevel): LogEntry[] {
    if (level) {
      return this.logs.filter((log) => log.level === level)
    }
    return [...this.logs]
  }

  clear(): void {
    this.logs = []
  }

  setLevel(level: LogLevel): void {
    this.level = level
  }
}

// Create logger instances for different contexts
// В renderer process process.env недоступен, используем проверку
function getLogLevel(): LogLevel {
  if (typeof process !== 'undefined' && process.env) {
    return (process.env.LOG_LEVEL as LogLevel) || 'info'
  }
  // В renderer можно использовать window.__ENV__ если он доступен
  if (typeof window !== 'undefined') {
    const windowWithEnv = window as Window & { __ENV__?: Record<string, string | undefined> }
    if (windowWithEnv.__ENV__?.LOG_LEVEL) {
      const level = windowWithEnv.__ENV__.LOG_LEVEL as LogLevel
      if (['error', 'warn', 'info', 'debug'].includes(level)) {
        return level
      }
    }
  }
  return 'info'
}

const logLevel = getLogLevel()

export const logger = new Logger(logLevel, 1000)

// Context-specific logger interface
interface ContextLogger {
  error: (message: string, error?: Error, extra?: Record<string, unknown>) => void
  warn: (message: string, extra?: Record<string, unknown>) => void
  info: (message: string, extra?: Record<string, unknown>) => void
  debug: (message: string, extra?: Record<string, unknown>) => void
}

// Context-specific loggers
export function createLogger(context: string): ContextLogger {
  return {
    error: (message: string, error?: Error, extra?: Record<string, unknown>) =>
      logger.error(`[${context}] ${message}`, error, extra),
    warn: (message: string, extra?: Record<string, unknown>) =>
      logger.warn(`[${context}] ${message}`, extra),
    info: (message: string, extra?: Record<string, unknown>) =>
      logger.info(`[${context}] ${message}`, extra),
    debug: (message: string, extra?: Record<string, unknown>) =>
      logger.debug(`[${context}] ${message}`, extra)
  }
}
