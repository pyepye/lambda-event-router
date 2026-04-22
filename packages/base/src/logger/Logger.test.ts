import type { MockInstance } from 'vitest';

import type { LogLevelName } from './Logger.js';
import { Logger } from './Logger.js';

type LogMethodName = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'critical';
type ConsoleMethodName = 'log' | 'debug' | 'warn' | 'error';

const logMethods: Array<[LogMethodName, ConsoleMethodName, string]> = [
  ['trace', 'log', '[TRACE]'],
  ['debug', 'debug', '[DEBUG]'],
  ['info', 'log', '[INFO]'],
  ['warn', 'warn', '[WARN]'],
  ['error', 'error', '[ERROR]'],
  ['critical', 'error', '[CRITICAL]'],
];

let consoleLogSpy: MockInstance;
let consoleDebugSpy: MockInstance;
let consoleWarnSpy: MockInstance;
let consoleErrorSpy: MockInstance;

beforeEach(() => {
  delete process.env.AWS_LAMBDA_LOG_LEVEL;
  delete process.env.AWS_LAMBDA_LOG_FORMAT;
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

suite('Logger', () => {
  suite('constructor', () => {
    test.each<[string, string | undefined, LogLevelName]>([
      ['unset env defaults to INFO', undefined, 'INFO'],
      ['lower-case env is uppercased', 'debug', 'DEBUG'],
      ['upper-case env passes through', 'WARN', 'WARN'],
      ['TRACE env accepted', 'TRACE', 'TRACE'],
    ])('%s', (_label, envValue, expected) => {
      if (envValue !== undefined) {
        process.env.AWS_LAMBDA_LOG_LEVEL = envValue;
      }
      const logger = new Logger();
      expect(logger.getLevelName()).toBe(expected);
    });

    test('invalid env value logs an error and defaults to INFO', () => {
      process.env.AWS_LAMBDA_LOG_LEVEL = 'FOO';
      const logger = new Logger();
      expect(logger.getLevelName()).toBe('INFO');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Logger] Invalid AWS_LAMBDA_LOG_LEVEL value: "FOO", defaulting to INFO',
      );
    });

    test('options.logLevel overrides env and suppresses the invalid-env error', () => {
      process.env.AWS_LAMBDA_LOG_LEVEL = 'FOO';
      const logger = new Logger({ logLevel: 'ERROR' });
      expect(logger.getLevelName()).toBe('ERROR');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    test('options are applied to emitted meta', () => {
      const logger = new Logger({
        logLevel: 'INFO',
        persistentLogAttributes: { tenantId: 'acme' },
        serviceName: 'orders',
      });
      logger.info('hello');
      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO]', {
        message: 'hello',
        meta: { serviceName: 'orders', tenantId: 'acme' },
      });
    });

    test('no serviceName means no serviceName key in meta', () => {
      const logger = new Logger({ logLevel: 'INFO' });
      logger.info('hello');
      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO]', { message: 'hello', meta: {} });
    });
  });

  suite('setLogLevel', () => {
    test('updates the level when given a valid value', () => {
      const logger = new Logger();
      logger.setLogLevel('DEBUG');
      expect(logger.getLevelName()).toBe('DEBUG');
    });

    test('logs an error and leaves level unchanged for an invalid value', () => {
      const logger = new Logger({ logLevel: 'WARN' });
      // @ts-expect-error - testing invalid input at runtime
      logger.setLogLevel('NOPE');
      expect(logger.getLevelName()).toBe('WARN');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[Logger] Invalid log level "NOPE", ignoring');
    });
  });

  suite('log methods', () => {
    test.each(logMethods)('%s uses console.%s with prefix %s', (method, consoleName, prefix) => {
      const logger = new Logger({ logLevel: 'TRACE' });
      logger[method]('hello', { foo: 'bar' });
      const spyByConsoleName = {
        log: consoleLogSpy,
        debug: consoleDebugSpy,
        warn: consoleWarnSpy,
        error: consoleErrorSpy,
      };
      expect(spyByConsoleName[consoleName]).toHaveBeenCalledWith(prefix, {
        message: 'hello',
        meta: { foo: 'bar' },
      });
    });

    test.each<[LogLevelName, Record<LogMethodName, boolean>]>([
      ['TRACE', { trace: true, debug: true, info: true, warn: true, error: true, critical: true }],
      ['DEBUG', { trace: false, debug: true, info: true, warn: true, error: true, critical: true }],
      ['INFO', { trace: false, debug: false, info: true, warn: true, error: true, critical: true }],
      ['WARN', { trace: false, debug: false, info: false, warn: true, error: true, critical: true }],
      ['ERROR', { trace: false, debug: false, info: false, warn: false, error: true, critical: true }],
      ['CRITICAL', { trace: false, debug: false, info: false, warn: false, error: false, critical: true }],
      ['SILENT', { trace: false, debug: false, info: false, warn: false, error: false, critical: false }],
    ])('at %s level emits only methods at or above the threshold', (logLevel, emits) => {
      const logger = new Logger({ logLevel });
      for (const [method] of logMethods) {
        logger[method]('msg');
      }
      const totalEmissions =
        consoleLogSpy.mock.calls.length +
        consoleDebugSpy.mock.calls.length +
        consoleWarnSpy.mock.calls.length +
        consoleErrorSpy.mock.calls.length;
      const expectedEmissions = Object.values(emits).filter(Boolean).length;
      expect(totalEmissions).toBe(expectedEmissions);
    });

    test('non-string message is JSON-stringified', () => {
      const logger = new Logger({ logLevel: 'INFO' });
      logger.info({ a: 1 });
      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO]', { message: '{"a":1}', meta: {} });
    });

    test('meta arg overrides temporary keys which override persistent keys', () => {
      const logger = new Logger({
        logLevel: 'INFO',
        persistentLogAttributes: { a: 'persistent', b: 'persistent', c: 'persistent' },
      });
      logger.appendKeys({ b: 'temporary', c: 'temporary' });
      logger.info('hello', { c: 'meta' });
      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO]', {
        message: 'hello',
        meta: { a: 'persistent', b: 'temporary', c: 'meta' },
      });
    });
  });

  suite('JSON log format (AWS_LAMBDA_LOG_FORMAT=JSON)', () => {
    test('string message emits single flattened object with no [LEVEL] prefix', () => {
      process.env.AWS_LAMBDA_LOG_FORMAT = 'JSON';
      const logger = new Logger({ logLevel: 'INFO', serviceName: 'orders' });
      logger.info('hello', { requestId: 'abc' });
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith({
        message: 'hello',
        serviceName: 'orders',
        requestId: 'abc',
      });
    });

    test('object message is spread into the top level alongside meta', () => {
      process.env.AWS_LAMBDA_LOG_FORMAT = 'JSON';
      const logger = new Logger({ logLevel: 'INFO' });
      logger.info({ event: 'login', userId: 'u1' }, { requestId: 'abc' });
      expect(consoleLogSpy).toHaveBeenCalledWith({
        event: 'login',
        userId: 'u1',
        requestId: 'abc',
      });
    });

    test('object messages are not stringified', () => {
      process.env.AWS_LAMBDA_LOG_FORMAT = 'JSON';
      const logger = new Logger({ logLevel: 'INFO' });
      logger.info({ nested: { a: 1 } });
      const firstCall = consoleLogSpy.mock.calls[0];
      const firstArg: unknown = firstCall?.[0];
      expect(firstArg).toEqual({ nested: { a: 1 } });
      expect(typeof firstArg).toBe('object');
    });

    test('warn/error/critical also emit structured single-object payloads', () => {
      process.env.AWS_LAMBDA_LOG_FORMAT = 'JSON';
      const logger = new Logger({ logLevel: 'TRACE' });
      logger.warn('w');
      logger.error('e');
      logger.critical('c');
      expect(consoleWarnSpy).toHaveBeenCalledWith({ message: 'w' });
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(1, { message: 'e' });
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(2, { message: 'c' });
    });

    test('meta order still applies: explicit meta overrides temporary overrides persistent', () => {
      process.env.AWS_LAMBDA_LOG_FORMAT = 'JSON';
      const logger = new Logger({
        logLevel: 'INFO',
        persistentLogAttributes: { a: 'persistent', b: 'persistent', c: 'persistent' },
      });
      logger.appendKeys({ b: 'temporary', c: 'temporary' });
      logger.info('hello', { c: 'meta' });
      expect(consoleLogSpy).toHaveBeenCalledWith({
        message: 'hello',
        a: 'persistent',
        b: 'temporary',
        c: 'meta',
      });
    });
  });

  suite('keys', () => {
    test('appendKeys, removeKeys, and resetKeys manage temporary meta', () => {
      const logger = new Logger({ logLevel: 'INFO' });
      logger.appendKeys({ requestId: '123', userId: 'u1' });
      logger.info('with-both');
      expect(consoleLogSpy).toHaveBeenLastCalledWith('[INFO]', {
        message: 'with-both',
        meta: { requestId: '123', userId: 'u1' },
      });

      logger.removeKeys(['requestId']);
      logger.info('after-remove');
      expect(consoleLogSpy).toHaveBeenLastCalledWith('[INFO]', {
        message: 'after-remove',
        meta: { userId: 'u1' },
      });

      logger.resetKeys();
      logger.info('after-reset');
      expect(consoleLogSpy).toHaveBeenLastCalledWith('[INFO]', {
        message: 'after-reset',
        meta: {},
      });
    });

    test('appendPersistentKeys and removePersistentKeys manage persistent meta', () => {
      const logger = new Logger({ logLevel: 'INFO' });
      logger.appendPersistentKeys({ tenantId: 'acme', region: 'eu' });
      logger.info('first');
      expect(consoleLogSpy).toHaveBeenLastCalledWith('[INFO]', {
        message: 'first',
        meta: { tenantId: 'acme', region: 'eu' },
      });

      logger.removePersistentKeys(['tenantId']);
      logger.info('second');
      expect(consoleLogSpy).toHaveBeenLastCalledWith('[INFO]', {
        message: 'second',
        meta: { region: 'eu' },
      });
    });
  });
});
