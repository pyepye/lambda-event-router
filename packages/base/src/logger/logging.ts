import { Logger } from './Logger.js';

// Our default Logger should have parity with the powertools logger
let loggerSingleton: Logger = new Logger();

export function setLogger(clientLogger: Logger): void {
  loggerSingleton = clientLogger;
}

export function getLogger(): Logger {
  try {
    const PowertoolsLogger = require('@aws-lambda-powertools/logger').Logger;
    loggerSingleton = new PowertoolsLogger();
  } catch {}
  return loggerSingleton;
}

export const logger: Logger = new Proxy({} as Logger, {
  get(_target: Logger, prop: keyof Logger): Logger[keyof Logger] {
    const loggerInstance = getLogger();
    const fn = loggerInstance[prop];
    if (typeof fn === 'function') return fn.bind(loggerInstance) as Logger[keyof Logger];
    return (() => {}) as Logger[keyof Logger];
  },
});
