import type { MockInstance } from 'vitest';
import { onTestFinished, vi } from 'vitest';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'critical';

type LogMethod = (message: unknown, meta?: never) => void;

export function silenceLog<TLevel extends LogLevel>(
  logger: Record<TLevel, LogMethod>,
  level: TLevel,
): MockInstance<LogMethod> {
  const methods: Partial<Record<LogLevel, LogMethod>> = logger;
  const method: LogLevel = level;
  const spy = vi.spyOn(methods, method).mockImplementation(() => undefined);
  onTestFinished(() => {
    spy.mockRestore();
  });
  return spy;
}
