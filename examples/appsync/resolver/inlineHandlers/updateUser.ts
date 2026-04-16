import { defineRoute } from '@lambda-event-router/appsync';

// Mutation resolver - updates an existing user using pipeline resolver context.
// Uses stash and prev to coordinate with other resolvers in the pipeline.
export const updateUserRoute = defineRoute({
  filters: {
    parentTypeName: 'Mutation',
    fieldName: 'updateUser',
  },
}).handle(async (request) => {
  const { arguments: args, stash, prev } = request;

  const userId = args.id;
  const input = args.input;

  // prev.result contains the output from the previous pipeline resolver
  const previousResult = prev?.result;
  console.log(`Previous pipeline result: ${JSON.stringify(previousResult)}`);

  // stash is shared mutable state across pipeline resolvers
  console.log(`Pipeline stash: ${JSON.stringify(stash)}`);

  // e.g. update DynamoDB item
  console.log(`Updating user ${userId}: ${JSON.stringify(input)}`);

  const inputFields = typeof input === 'object' && input !== null ? input : {};

  return {
    id: userId,
    ...inputFields,
    updatedAt: new Date().toISOString(),
  };
});
