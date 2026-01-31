import type { Schema } from '@lambda-event-router/base';

export interface StepFunctionsFilterInput {
  event: unknown;
}

export interface StepFunctionsFilters {
  taskToken?: boolean;
  customFilter?: (input: StepFunctionsFilterInput) => boolean;
}

export type StepFunctionsRequest<TInput = unknown> = TInput;

export interface StepFunctionsTaskTokenRequest<TInput = unknown> {
  taskToken: string;
  input: TInput;
}

export type StepFunctionsHandler<TInput = unknown> = (request: StepFunctionsRequest<TInput>) => Promise<unknown>;

export type StepFunctionsTaskTokenHandler<TInput = unknown> = (
  request: StepFunctionsTaskTokenRequest<TInput>,
) => Promise<unknown>;

export interface StepFunctionsRouteDefinition<TInput = unknown> {
  filters: StepFunctionsFilters;
  eventSchema?: Schema<TInput>;
  handler: StepFunctionsHandler<TInput>;
}

export interface StepFunctionsTaskTokenRouteDefinition<TInput = unknown> {
  filters: StepFunctionsFilters & { taskToken: true };
  eventSchema?: Schema<TInput>;
  handler: StepFunctionsTaskTokenHandler<TInput>;
}
