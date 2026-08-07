import { z } from 'zod';

// Config delivers every rule parameter as a string. Each schema below turns one into the type the
// handler wants, and the two rules with a typo in their parameters fail here.

export const ApprovedRuntimeParametersSchema = z.object({
  allowedRuntimes: z.string().transform((value) => value.split(',').map((runtime) => runtime.trim())),
});

export const MemoryLimitParametersSchema = z.object({
  maxMemoryMb: z.coerce.number().int().positive(),
});

export const TimeoutLimitParametersSchema = z.object({
  maxTimeoutSeconds: z.coerce.number().int().positive(),
});

export const LambdaInventoryParametersSchema = z.object({
  maxFunctions: z.coerce.number().int().positive(),
});

export type TLambdaInventoryParameters = z.infer<typeof LambdaInventoryParametersSchema>;

export const IdleFunctionSweepParametersSchema = z.object({
  maxIdleDays: z.coerce.number().int().positive(),
});

// The parts of a Lambda function's configuration item that each rule reads.

export const RuntimeConfigurationSchema = z.object({
  functionName: z.string(),
  runtime: z.string(),
});

export const MemoryConfigurationSchema = z.object({
  functionName: z.string(),
  memorySize: z.number().int(),
});

export const TimeoutConfigurationSchema = z.object({
  functionName: z.string(),
  timeout: z.number().int(),
});

// A function with no description fails here, which is how report-builder fails the catalogue rule.
export const CatalogueConfigurationSchema = z.object({
  functionName: z.string(),
  description: z.string().min(1),
});
