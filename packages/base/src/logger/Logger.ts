export type LogLevelName = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL' | 'SILENT';

// Values mirror @aws-lambda-powertools/logger for potential cross-compatibility.
const levelPriority: Record<LogLevelName, number> = {
  TRACE: 6,
  DEBUG: 8,
  INFO: 12,
  WARN: 16,
  ERROR: 20,
  CRITICAL: 24,
  SILENT: 28,
};

function isLogLevelName(value: string): value is LogLevelName {
  return value in levelPriority;
}

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
  private jsonLogFormat: boolean;

  constructor(options?: LoggerOptions) {
    const rawEnvLevel = process.env.AWS_LAMBDA_LOG_LEVEL?.toUpperCase();
    const envLevel = rawEnvLevel && isLogLevelName(rawEnvLevel) ? rawEnvLevel : undefined;
    if (!options?.logLevel && rawEnvLevel && !envLevel) {
      console.error(`[Logger] Invalid AWS_LAMBDA_LOG_LEVEL value: "${rawEnvLevel}", defaulting to INFO`);
    }
    this.logLevel = options?.logLevel ?? envLevel ?? 'INFO';
    this.persistentLogAttributes = options?.persistentLogAttributes ?? {};
    this.temporaryKeys = {};
    this.serviceName = options?.serviceName;
    this.jsonLogFormat = process.env.AWS_LAMBDA_LOG_FORMAT === 'JSON';
  }

  getLevelName(): LogLevelName {
    return this.logLevel;
  }

  setLogLevel(logLevel: LogLevelName): void {
    if (!isLogLevelName(logLevel)) {
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
    // SILENT is the highest priority value, so this comparison implicitly blocks every log level.
    return levelPriority[level] >= levelPriority[this.logLevel];
  }

  private mergedMeta(meta?: LogMeta): LogMeta {
    return {
      ...(this.serviceName && { serviceName: this.serviceName }),
      ...this.persistentLogAttributes,
      ...this.temporaryKeys,
      ...(meta ?? {}),
    };
  }

  private formatText(message: unknown, meta?: LogMeta): LogProps {
    return {
      message: typeof message === 'string' ? message : JSON.stringify(message),
      meta: this.mergedMeta(meta),
    };
  }

  // In Lambda JSON log mode, passing a single object to console keeps its properties queryable.
  // Passing multiple args (or a pre-stringified object) collapses into a stringified `message`
  private formatJson(message: unknown, meta?: LogMeta): Record<string, unknown> {
    const mergedMeta = this.mergedMeta(meta);
    if (typeof message === 'object' && message !== null) {
      return { ...message, ...mergedMeta };
    }
    return { message, ...mergedMeta };
  }

  trace(message: unknown, meta?: LogMeta): void {
    if (!this.shouldLog('TRACE')) return;
    if (this.jsonLogFormat) {
      console.log(this.formatJson(message, meta));
      return;
    }
    console.log('[TRACE]', this.formatText(message, meta));
  }

  debug(message: unknown, meta?: LogMeta): void {
    if (!this.shouldLog('DEBUG')) return;
    if (this.jsonLogFormat) {
      console.debug(this.formatJson(message, meta));
      return;
    }
    console.debug('[DEBUG]', this.formatText(message, meta));
  }

  info(message: unknown, meta?: LogMeta): void {
    if (!this.shouldLog('INFO')) return;
    if (this.jsonLogFormat) {
      console.log(this.formatJson(message, meta));
      return;
    }
    console.log('[INFO]', this.formatText(message, meta));
  }

  warn(message: unknown, meta?: LogMeta): void {
    if (!this.shouldLog('WARN')) return;
    if (this.jsonLogFormat) {
      console.warn(this.formatJson(message, meta));
      return;
    }
    console.warn('[WARN]', this.formatText(message, meta));
  }

  error(message: unknown, meta?: LogMeta): void {
    if (!this.shouldLog('ERROR')) return;
    if (this.jsonLogFormat) {
      console.error(this.formatJson(message, meta));
      return;
    }
    console.error('[ERROR]', this.formatText(message, meta));
  }

  critical(message: unknown, meta?: LogMeta): void {
    if (!this.shouldLog('CRITICAL')) return;
    if (this.jsonLogFormat) {
      console.error(this.formatJson(message, meta));
      return;
    }
    console.error('[CRITICAL]', this.formatText(message, meta));
  }
}
