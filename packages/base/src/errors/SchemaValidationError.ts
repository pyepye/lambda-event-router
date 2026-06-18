import type { StandardSchemaV1 } from '@standard-schema/spec';

const SCHEMA_VALIDATION = 'SchemaValidationError';

export class SchemaValidationError extends Error {
  override readonly name = SCHEMA_VALIDATION;
  readonly issues: ReadonlyArray<StandardSchemaV1.Issue>;

  constructor(message: string, issues: ReadonlyArray<StandardSchemaV1.Issue>) {
    super(message);
    this.issues = issues;
  }

  static isSchemaValidationError(error: unknown): error is SchemaValidationError {
    return error instanceof Error && error.name === SCHEMA_VALIDATION;
  }
}
