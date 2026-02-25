import { defineRoute } from '@lambda-event-router/appsync';
import { z } from 'zod';

const CreateUserInputSchema = z.object({
  input: z.object({
    name: z.string(),
    email: z.string().email(),
  }),
});

// Mutation resolver — creates a new user.
// Uses argumentsSchema for input validation and headers for tracing context.
export const createUserRoute = defineRoute({
  filters: {
    parentTypeNames: ['Mutation'],
    fieldNames: ['createUser'],
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
