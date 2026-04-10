import { defineRoute } from '@lambda-event-router/appsync';

// Uses arguments for the GraphQL field args and selectionSetList to optimize the response.
export const getUserRoute = defineRoute({
  filters: {
    parentTypeNames: ['Query'],
    fieldNames: ['getUser'],
  },
}).handle(async (request) => {
  const { arguments: args, info } = request;

  const userId = args.id;
  const requestedFields = info.selectionSetList;

  // e.g. fetch from DynamoDB, projecting only the requested fields
  console.log(`Fetching user ${userId}, fields: ${requestedFields.join(', ')}`);

  return {
    id: userId,
    name: 'Jane Doe',
    email: 'jane@example.com',
  };
});
