type LogLevel = 'error' | 'warn' | 'info'

const isProd = process.env.NODE_ENV === 'production'

function shouldLog(level: LogLevel): boolean {
  if (!isProd) return true
  return level !== 'info'
}

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  if (!shouldLog(level)) return
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(meta && Object.keys(meta).length ? meta : {}),
  }
  console[level](payload)
}

export function logError(message: string, meta?: Record<string, unknown>) {
  emit('error', message, meta)
}

export function logWarn(message: string, meta?: Record<string, unknown>) {
  emit('warn', message, meta)
}

export function logInfo(message: string, meta?: Record<string, unknown>) {
  emit('info', message, meta)
}
