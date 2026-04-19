import type { MockInstance } from 'vitest';
import { Logger } from './Logger.js';
import { getLogger, logger, setLogger } from './logging.js';

let consoleLogSpy: MockInstance;

beforeEach(() => {
  delete process.env.AWS_LAMBDA_LOG_LEVEL;
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  setLogger(new Logger({ logLevel: 'SILENT' }));
});

afterEach(() => {
  vi.restoreAllMocks();
  setLogger(new Logger({ logLevel: 'SILENT' }));
});

suite('setLogger / getLogger', () => {
  test('getLogger returns a Logger instance by default', () => {
    expect(getLogger()).toBeInstanceOf(Logger);
  });

  test('setLogger replaces the instance returned by getLogger', () => {
    const replacement = new Logger({ logLevel: 'INFO', serviceName: 'replacement' });
    setLogger(replacement);
    expect(getLogger()).toBe(replacement);
  });
});

suite('logger proxy', () => {
  test('delegates method calls to the current logger', () => {
    setLogger(new Logger({ logLevel: 'INFO', serviceName: 'orders' }));
    logger.info('hello');
    expect(consoleLogSpy).toHaveBeenCalledWith('[INFO]', {
      message: 'hello',
      meta: { serviceName: 'orders' },
    });
  });

  test('picks up the latest logger between calls', () => {
    setLogger(new Logger({ logLevel: 'INFO', serviceName: 'first' }));
    logger.info('one');
    setLogger(new Logger({ logLevel: 'INFO', serviceName: 'second' }));
    logger.info('two');
    expect(consoleLogSpy).toHaveBeenNthCalledWith(1, '[INFO]', {
      message: 'one',
      meta: { serviceName: 'first' },
    });
    expect(consoleLogSpy).toHaveBeenNthCalledWith(2, '[INFO]', {
      message: 'two',
      meta: { serviceName: 'second' },
    });
  });

  test('returns a no-op for non-function properties', () => {
    // @ts-expect-error - accessing a non-existent property to verify the proxy fallback
    const result = logger.notARealMethod;
    expect(typeof result).toBe('function');
    expect(() => result()).not.toThrow();
    expect(result()).toBeUndefined();
  });
});
