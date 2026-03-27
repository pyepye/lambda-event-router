import type { StandardSchemaV1 } from '@standard-schema/spec';

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// TODO: Rename?
//       Do we even want this to be how it functions? Returning the rawData?
//       Sort out types
export function safeJsonParse(rawData?: string): unknown {
  if (!rawData) return undefined;

  try {
    return JSON.parse(rawData);
  } catch {
    return rawData;
  }
}

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

// TODO: Remove this type and replace with whatever StandardSchema returns
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; issues: ReadonlyArray<StandardSchemaV1.Issue> };

// TODO: If this is only used by HTTP then move it
//       Figure out if we need the success response in this way
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
