import type { AppSyncResolverRequest } from '@lambda-event-router/appsync';

// Standalone Query resolver — fetches a single user by ID.
// Uses arguments for the GraphQL field args and selectionSetList to optimize the response.
export async function getUser(request: AppSyncResolverRequest) {
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
}
