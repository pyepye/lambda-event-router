import type { Handler } from 'aws-lambda';

import { type AppSyncResolverFilterInput, createAppSyncRouter } from '@lambda-event-router/appsync';
import { LambdaRouter } from '@lambda-event-router/base';

import { CreateUserInputSchema, createUser } from './createUser.js';
import { getUser } from './getUser.js';
import { getUserPosts } from './getUserPosts.js';
import { listUsers } from './listUsers.js';
import { onUserCreated } from './onUserCreated.js';
import { updateUser } from './updateUser.js';

const appSyncRouter = createAppSyncRouter();

// Convenience methods for common parent types
appSyncRouter.query({
  fieldName: 'getUser',
  handler: getUser,
});

appSyncRouter.query({
  fieldName: 'listUsers',
  handler: listUsers,
});

appSyncRouter.mutation({
  fieldName: 'createUser',
  argumentsSchema: CreateUserInputSchema,
  handler: createUser,
});

appSyncRouter.mutation({
  fieldName: 'updateUser',
  handler: updateUser,
});

appSyncRouter.route({
  filters: {
    parentTypeName: 'User',
    fieldName: 'posts',
  },
  handler: getUserPosts,
});

appSyncRouter.subscription({
  fieldName: 'onUserCreated',
  handler: onUserCreated,
});

function isAdminMutation({ event }: AppSyncResolverFilterInput): boolean {
  const identity = event.identity;
  if (!(identity && 'claims' in identity)) return false;
  const claims = identity.claims as Record<string, unknown>;
  return claims['custom:role'] === 'admin';
}

appSyncRouter.route({
  filters: {
    parentTypeName: 'Mutation',
    fieldName: 'createUser',
    customFilter: isAdminMutation,
  },
  argumentsSchema: CreateUserInputSchema,
  handler: createUser,
});

const lambdaRouter = new LambdaRouter({
  routers: [appSyncRouter],
});

export const handler: Handler = lambdaRouter.handler();
