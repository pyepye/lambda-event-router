import { defineRoute } from '@lambda-event-router/appsync';

// Query resolver - lists users with pagination.
// Uses identity to scope results to the caller and arguments for pagination params.
export const listUsersRoute = defineRoute({
  filters: {
    parentTypeName: 'Query',
    fieldName: 'listUsers',
  },
}).handle(async (request) => {
  const { arguments: args, identity } = request;

  const limit = args.limit ?? 10;
  const nextToken = args.nextToken;

  // e.g. use identity to scope results to the caller's tenant
  console.log(`Listing users for identity: ${JSON.stringify(identity)}, limit: ${limit}`);

  return {
    items: [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ],
    nextToken: nextToken ? null : 'page-2-token',
  };
});
