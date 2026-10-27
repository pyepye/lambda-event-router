import type { AppSyncEventsMiddleware } from '@latcher/appsync';
import { logger } from '@latcher/base';

// Route middleware for ticket activity: names the ticket the channel's last segment points at.
export const withChannelContext: AppSyncEventsMiddleware = async (request, next) => {
  const segments = request.info.channel.segments;

  logger.info({ message: 'Ticket activity received', ticketId: segments[segments.length - 1] });

  return next(request);
};
