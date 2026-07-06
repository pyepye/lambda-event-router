import type {
  AppSyncEventsAuthorizerChannelRequest,
  AppSyncEventsAuthorizerConnectRequest,
  AppSyncEventsAuthorizerFilterInput,
} from '@lambda-event-router/appsync';
import { EventsAuthorized, EventsDenied } from '@lambda-event-router/appsync';
import { logger } from '@lambda-event-router/base';

import { AGENT_ROLE, TOKEN_GRANTS } from '../utils/constants.js';

// A connect names no channel, so the token is all there is to decide on.
export function isKnownToken({ event }: AppSyncEventsAuthorizerFilterInput): boolean {
  return event.authorizationToken in TOKEN_GRANTS;
}

export async function admitActivityConnection({ authorizationToken }: AppSyncEventsAuthorizerConnectRequest) {
  logger.info({ message: 'Activity connection admitted', token: authorizationToken });

  return EventsAuthorized({ ttlOverride: 0 });
}

export async function refuseUnknownConnection({ authorizationToken }: AppSyncEventsAuthorizerConnectRequest) {
  logger.info({ message: 'Activity connection refused', token: authorizationToken });

  return EventsDenied({ ttlOverride: 0 });
}

// `handlerContext` is the Event API's answer to `resolverContext`, and reaches the worker as
// `identity.handlerContext`. The channel is a plain string here, because a publish always names one.
export async function authoriseTicketActivity({
  authorizationToken,
  channelPath,
}: AppSyncEventsAuthorizerChannelRequest) {
  const grant = TOKEN_GRANTS[authorizationToken];

  if (grant?.role !== AGENT_ROLE) {
    logger.info({ message: 'Ticket publish refused', token: authorizationToken, channelPath });
    return EventsDenied({ ttlOverride: 0 });
  }

  logger.info({ message: 'Ticket publish authorised', token: authorizationToken, channelPath });

  return EventsAuthorized({ handlerContext: { role: grant.role, actorId: grant.actorId }, ttlOverride: 0 });
}

export async function admitPresenceWatcher({ channelPath }: AppSyncEventsAuthorizerChannelRequest) {
  logger.info({ message: 'Presence watcher authorised', channelPath });

  return EventsAuthorized({ ttlOverride: 0 });
}
