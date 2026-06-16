import type { Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { Middleware } from '@lambda-event-router/base';

export interface StepFunctionsFilterInput {
  event: unknown;
}

export interface StepFunctionsFilters {
  taskToken?: boolean;
  custom?: (input: StepFunctionsFilterInput) => boolean | Promise<boolean>;
}

export interface StepFunctionsRequest<TInput = unknown> {
  event: TInput;
  context: Context;
}

export interface StepFunctionsTaskTokenRequest<TInput = unknown> {
  taskToken: string;
  /** The payload with TaskToken removed, validated against eventSchema. */
  input: TInput;
  event: unknown;
  context: Context;
}

/** Middleware for a regular route, where `event` holds the validated payload. */
export type StepFunctionsMiddleware<TResponse = unknown, TInput = unknown> = Middleware<
  StepFunctionsRequest<TInput>,
  TResponse
>;

/** Middleware for a task token route, where `input` holds the validated payload and `event` is raw. */
export type StepFunctionsTaskTokenMiddleware<TResponse = unknown, TInput = unknown> = Middleware<
  StepFunctionsTaskTokenRequest<TInput>,
  TResponse
>;

export type StepFunctionsHandler<TInput = unknown> = (request: StepFunctionsRequest<TInput>) => Promise<unknown>;

export type StepFunctionsTaskTokenHandler<TInput = unknown> = (
  request: StepFunctionsTaskTokenRequest<TInput>,
) => Promise<unknown>;

export interface StepFunctionsRouteDefinition<TInput = unknown> {
  filters: StepFunctionsFilters;
  eventSchema?: StandardSchemaV1<unknown, TInput>;
  middleware?: StepFunctionsMiddleware<unknown, NoInfer<TInput>>[];
  handler: StepFunctionsHandler<TInput>;
}

export interface StepFunctionsTaskTokenRouteDefinition<TInput = unknown> {
  filters: StepFunctionsFilters & { taskToken: true };
  eventSchema?: StandardSchemaV1<unknown, TInput>;
  middleware?: StepFunctionsTaskTokenMiddleware<unknown, NoInfer<TInput>>[];
  handler: StepFunctionsTaskTokenHandler<TInput>;
}
