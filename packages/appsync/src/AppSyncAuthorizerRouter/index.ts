export {
  AppSyncAuthorizerRouter,
  createAppSyncAuthorizerRouter,
  defineAuthorizerRoute,
} from './AppSyncAuthorizerRouter.js';
export { Authorized, Denied, isAppSyncAuthorizerResponse } from './response.js';
export type {
  AppSyncAuthorizerRequest,
  AppSyncAuthorizerRouteDefinition,
} from './types.js';
