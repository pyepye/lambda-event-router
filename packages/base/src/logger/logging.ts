import { Logger } from './Logger.js';

let loggerSingleton: Logger | null = null;

async function tryResolvePowertools(): Promise<void> {
  if (loggerSingleton) return;
  try {
    // @ts-expect-error - @aws-lambda-powertools/logger is an optional peer dependency, types may be absent
    const powertoolsLoggerModule = await import('@aws-lambda-powertools/logger');
    if (!loggerSingleton) loggerSingleton = new powertoolsLoggerModule.Logger();
  } catch {
    // Powertools not installed - fall back to default Logger
  }
}

void tryResolvePowertools();

export function setLogger(clientLogger: Logger): void {
  loggerSingleton = clientLogger;
}

export function getLogger(): Logger {
  if (loggerSingleton) return loggerSingleton;
  loggerSingleton = new Logger();
  return loggerSingleton;
}

const proxyHandler: ProxyHandler<Logger> = {
  get(_target: Logger, prop: string | symbol): unknown {
    const loggerInstance = getLogger();
    const value = Reflect.get(loggerInstance, prop);
    if (typeof value === 'function') return value.bind(loggerInstance);
    return () => {};
  },
};

const proxyTarget: Logger = new Logger();
export const logger: Logger = new Proxy(proxyTarget, proxyHandler);
