import { silenceLog } from './silenceLog.js';

const printed: string[] = [];

function logError(message: unknown, _meta?: Record<string, unknown>): void {
  printed.push(`error: ${String(message)}`);
}

function logWarn(message: unknown): void {
  printed.push(`warn: ${String(message)}`);
}

const orderLogger: { error: typeof logError; warn: typeof logWarn } = { error: logError, warn: logWarn };

suite('silenceLog', () => {
  beforeEach(() => {
    printed.length = 0;
  });

  test('stops the log method from running', () => {
    silenceLog(orderLogger, 'error');

    orderLogger.error('Order failed');

    expect(printed).toEqual([]);
  });

  test('returns a spy that records each call', () => {
    const errorLog = silenceLog(orderLogger, 'error');

    orderLogger.error('Order failed', { orderId: 'ord-1' });

    expect(errorLog).toHaveBeenCalledWith('Order failed', { orderId: 'ord-1' });
  });

  test('leaves the other log methods running', () => {
    silenceLog(orderLogger, 'error');

    orderLogger.warn('Order slow');

    expect(printed).toEqual(['warn: Order slow']);
  });

  // Runs after the tests above, so it sees the method each of them silenced
  test('restores the log method once the test finishes', () => {
    expect(orderLogger.error).toBe(logError);
  });
});
