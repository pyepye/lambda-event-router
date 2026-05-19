import { z } from 'zod';

import { type AppSyncResolverFilterInput, defineRoute } from '@lambda-event-router/appsync';

const CreateUserInputSchema = z.object({
  input: z.object({
    name: z.string(),
    email: z.string().email(),
  }),
});

// Uses argumentsSchema for input validation and headers for tracing context.
export const createUserRoute = defineRoute({
  filters: {
    parentTypeName: 'Mutation',
    fieldName: 'createUser',
  },
  argumentsSchema: CreateUserInputSchema,
}).handle(async (request) => {
  const { arguments: args, headers } = request;

  // args is validated and typed via CreateUserInputSchema
  const { name, email } = args.input;
  const traceId = headers?.['x-trace-id'];

  // e.g. write to DynamoDB, publish to EventBridge
  console.log(`Creating user: ${name}, email: ${email}, traceId: ${traceId}`);

  return {
    id: 'new-user-123',
    name,
    email,
    createdAt: new Date().toISOString(),
  };
});

// Match admin mutations using custom filter on identity claims
export const adminCreateUserRoute = defineRoute({
  filters: {
    parentTypeName: 'Mutation',
    fieldName: 'createUser',
    custom: ({ event }: AppSyncResolverFilterInput) => {
      const identity = event.identity;
      if (!(identity && 'claims' in identity)) return false;
      const claims = identity.claims as Record<string, unknown>;
      return claims['custom:role'] === 'admin';
    },
  },
  argumentsSchema: CreateUserInputSchema,
}).handle(async (request) => {
  const { arguments: args } = request;
  const { name, email } = args.input;

  console.log(`Admin creating user: ${name}, email: ${email}`);

  return {
    id: 'admin-created-123',
    name,
    email,
    createdAt: new Date().toISOString(),
  };
});
