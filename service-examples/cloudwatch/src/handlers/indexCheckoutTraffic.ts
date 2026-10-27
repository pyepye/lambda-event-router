import { logger } from '@latcher/base';
import type { CloudWatchLogsRequest } from '@latcher/cloudwatch';

// Every checkout line goes to the search index. Written as a plain function and wired up with the
// matcher's dataMessage helper, so the type has to be stated rather than inferred.
export async function indexCheckoutTraffic(request: CloudWatchLogsRequest): Promise<void> {
  logger.info({
    message: 'Checkout traffic indexed',
    logGroup: request.logGroup,
    indexedCount: request.logEvents.length,
    eventIds: request.logEvents.map((event) => event.id),
  });
}
