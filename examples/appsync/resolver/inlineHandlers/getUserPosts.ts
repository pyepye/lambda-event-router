import { defineRoute } from '@lambda-event-router/appsync';

// Nested resolver - resolves the `posts` field on a User type.
// `source` contains the parent User object returned by the parent resolver.
export const getUserPostsRoute = defineRoute({
  filters: {
    parentTypeName: 'User',
    fieldName: 'posts',
  },
}).handle(async (request) => {
  const { source, arguments: args, info } = request;

  const userId = source?.id;
  const limit = args.limit ?? 10;
  const requestedFields = info.selectionSetList;

  // e.g. fetch posts from DynamoDB using the parent User's ID
  console.log(`Fetching posts for user ${userId}, limit: ${limit}`);
  console.log(`Requested fields: ${requestedFields.join(', ')}`);

  return [
    { id: 'post-1', title: 'First Post', authorId: userId },
    { id: 'post-2', title: 'Second Post', authorId: userId },
  ];
});
