import type { StandardSchemaV1 } from '@standard-schema/spec';
import { vi } from 'vitest';

type MockSchema<TOutput = unknown> = StandardSchemaV1<unknown, TOutput> & {
  '~standard': { validate: ReturnType<typeof vi.fn> };
};

export function createMockSchema<TOutput = unknown>(): MockSchema<TOutput>;
export function createMockSchema<TOutput = unknown>(result: StandardSchemaV1.Result<TOutput>): MockSchema<TOutput>;
export function createMockSchema<TOutput = unknown>(result?: StandardSchemaV1.Result<TOutput>): MockSchema<TOutput> {
  return {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: result ? vi.fn(() => result) : vi.fn((input: unknown) => ({ value: input as TOutput })),
    },
  };
}
