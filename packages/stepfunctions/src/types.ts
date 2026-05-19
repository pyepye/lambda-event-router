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

/**
 * Typed over the two keys both request shapes carry, so one middleware runs on either kind of route.
 * A task token route's request also has taskToken and input, which middleware does not see.
 */
export type StepFunctionsMiddleware<TResponse = unknown> = Middleware<StepFunctionsRequest, TResponse>;

export type StepFunctionsHandler<TInput = unknown> = (request: StepFunctionsRequest<TInput>) => Promise<unknown>;

export type StepFunctionsTaskTokenHandler<TInput = unknown> = (
  request: StepFunctionsTaskTokenRequest<TInput>,
) => Promise<unknown>;

export interface StepFunctionsRouteDefinition<TInput = unknown> {
  filters: StepFunctionsFilters;
  eventSchema?: StandardSchemaV1<unknown, TInput>;
  middleware?: StepFunctionsMiddleware[];
  handler: StepFunctionsHandler<TInput>;
}

export interface StepFunctionsTaskTokenRouteDefinition<TInput = unknown> {
  filters: StepFunctionsFilters & { taskToken: true };
  eventSchema?: StandardSchemaV1<unknown, TInput>;
  middleware?: StepFunctionsMiddleware[];
  handler: StepFunctionsTaskTokenHandler<TInput>;
}
