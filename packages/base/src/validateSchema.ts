import type { StandardSchemaV1 } from '@standard-schema/spec';

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; issues: ReadonlyArray<StandardSchemaV1.Issue> };

export async function validateSchema(
  data: unknown,
  schema: StandardSchemaV1 | undefined,
  customErrorMessage?: string,
): Promise<unknown> {
  if (!schema) {
    return data;
  }

  const result = await schema['~standard'].validate(data);
  if (result.issues) {
    const errorMessage = customErrorMessage ?? 'Schema validation failed';
    throw new Error(errorMessage, { cause: result.issues });
  }
  return result.value;
}

export async function validateSchemaResult<T>(
  data: T,
  schema: StandardSchemaV1 | undefined,
): Promise<ValidationResult<T>> {
  if (!schema) {
    return { success: true, data };
  }

  const result = await schema['~standard'].validate(data);
  if (result.issues) {
    return { success: false, issues: result.issues };
  }
  return { success: true, data: result.value as T };
}
