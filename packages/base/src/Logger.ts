export type LogLevelName = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL' | 'SILENT';

const levelPriority: Record<LogLevelName, number> = {
  TRACE: 6,
  DEBUG: 8,
  INFO: 12,
  WARN: 16,
  ERROR: 20,
  CRITICAL: 24,
  SILENT: 28,
};

export type LogMeta = Record<string, unknown>;
type LogProps = { message: string; meta: LogMeta };

export interface LoggerOptions {
  logLevel?: LogLevelName;
  persistentLogAttributes?: LogMeta;
  serviceName?: string;
}

export class Logger {
  private logLevel: LogLevelName;
  private persistentLogAttributes: LogMeta;
  private temporaryKeys: LogMeta;
  private serviceName?: string;

  constructor(options?: LoggerOptions) {
    const envLevel = process.env.AWS_LAMBDA_LOG_LEVEL?.toUpperCase() as LogLevelName | undefined;
    if (!options?.logLevel && envLevel && !(envLevel in levelPriority)) {
      console.error(`[Logger] Invalid AWS_LAMBDA_LOG_LEVEL value: "${envLevel}", defaulting to INFO`);
    }
    this.logLevel = options?.logLevel ?? envLevel ?? 'INFO';
    this.persistentLogAttributes = options?.persistentLogAttributes ?? {};
    this.temporaryKeys = {};
    this.serviceName = options?.serviceName;
  }

  getLevelName(): LogLevelName {
    return this.logLevel;
  }

  setLogLevel(logLevel: LogLevelName): void {
    if (!(logLevel in levelPriority)) {
      console.error(`[Logger] Invalid log level "${logLevel}", ignoring`);
      return;
    }
    this.logLevel = logLevel;
  }

  appendKeys(keys: LogMeta): void {
    this.temporaryKeys = { ...this.temporaryKeys, ...keys };
  }

  removeKeys(keys: string[]): void {
    for (const key of keys) {
      delete this.temporaryKeys[key];
    }
  }

  resetKeys(): void {
    this.temporaryKeys = {};
  }

  appendPersistentKeys(keys: LogMeta): void {
    this.persistentLogAttributes = { ...this.persistentLogAttributes, ...keys };
  }

  removePersistentKeys(keys: string[]): void {
    for (const key of keys) {
      delete this.persistentLogAttributes[key];
    }
  }

  private shouldLog(level: LogLevelName): boolean {
    return levelPriority[level] >= levelPriority[this.logLevel] && this.logLevel !== 'SILENT';
  }

  private formatMessage(message: unknown, meta?: LogMeta): LogProps {
    return {
      message: typeof message === 'string' ? message : JSON.stringify(message),
      meta: {
        ...(this.serviceName && { serviceName: this.serviceName }),
        ...this.persistentLogAttributes,
        ...this.temporaryKeys,
        ...(meta ?? {}),
      },
    };
  }

  trace(message: unknown, meta?: LogMeta): void {
    if (!this.shouldLog('TRACE')) return;
    console.log('[TRACE]', this.formatMessage(message, meta));
  }

  debug(message: unknown, meta?: LogMeta): void {
    if (!this.shouldLog('DEBUG')) return;
    console.debug('[DEBUG]', this.formatMessage(message, meta));
  }

  info(message: unknown, meta?: LogMeta): void {
    if (!this.shouldLog('INFO')) return;
    console.log('[INFO]', this.formatMessage(message, meta));
  }

  warn(message: unknown, meta?: LogMeta): void {
    if (!this.shouldLog('WARN')) return;
    console.warn('[WARN]', this.formatMessage(message, meta));
  }

  error(message: unknown, meta?: LogMeta): void {
    if (!this.shouldLog('ERROR')) return;
    console.error('[ERROR]', this.formatMessage(message, meta));
  }

  critical(message: unknown, meta?: LogMeta): void {
    if (!this.shouldLog('CRITICAL')) return;
    console.error('[CRITICAL]', this.formatMessage(message, meta));
  }
}
