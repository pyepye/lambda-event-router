import type { S3BatchEventTask } from 'aws-lambda';

import type { MockSchema, S3BatchTaskOverrides } from './index.js';
import { createMockSchema, createS3BatchTask } from './index.js';

suite('testing package type exports', () => {
  test('MockSchema is the return type of createMockSchema', () => {
    expectTypeOf(createMockSchema<string>()).toEqualTypeOf<MockSchema<string>>();
  });

  test('S3BatchTaskOverrides is the parameter type of createS3BatchTask', () => {
    const overrides: S3BatchTaskOverrides = { s3Key: 'orders/1.json' };

    expectTypeOf(createS3BatchTask(overrides)).toEqualTypeOf<S3BatchEventTask>();
  });
});
