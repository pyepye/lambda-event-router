import type { AppSyncResolverRequest } from '@lambda-event-router/appsync';
import { z } from 'zod';

const CreateUserInputSchema = z.object({
  input: z.object({
    name: z.string(),
    email: z.string().email(),
  }),
});

type CreateUserArgs = z.infer<typeof CreateUserInputSchema>;

// Uses argumentsSchema for input validation and headers for tracing context.
// In the separate handler style, define the schema alongside and use the inferred type.
export { CreateUserInputSchema };

export async function createUser(request: AppSyncResolverRequest<CreateUserArgs>) {
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
}
