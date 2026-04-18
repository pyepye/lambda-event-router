import type { StandardSchemaV1 } from '@standard-schema/spec';

export interface StepFunctionsFilterInput {
  event: unknown;
}

export interface StepFunctionsFilters {
  taskToken?: boolean;
  customFilter?: (input: StepFunctionsFilterInput) => boolean | Promise<boolean>;
}

export type StepFunctionsRequest<TInput = unknown> = TInput;

export interface StepFunctionsTaskTokenRequest<TInput = unknown> {
  taskToken: string;
  input: TInput;
  event: unknown;
}

export type StepFunctionsHandler<TInput = unknown> = (request: StepFunctionsRequest<TInput>) => Promise<unknown>;

export type StepFunctionsTaskTokenHandler<TInput = unknown> = (
  request: StepFunctionsTaskTokenRequest<TInput>,
) => Promise<unknown>;

export interface StepFunctionsRouteDefinition<TInput = unknown> {
  filters: StepFunctionsFilters;
  eventSchema?: StandardSchemaV1<unknown, TInput>;
  handler: StepFunctionsHandler<TInput>;
}

export interface StepFunctionsTaskTokenRouteDefinition<TInput = unknown> {
  filters: StepFunctionsFilters & { taskToken: true };
  eventSchema?: StandardSchemaV1<unknown, TInput>;
  handler: StepFunctionsTaskTokenHandler<TInput>;
}
