import { createWebSocketRouter } from '@lambda-event-router/apigateway';

import { broadcastAlert } from './handlers/broadcastAlert.js';
import { closeAlertStream } from './handlers/closeAlertStream.js';
import { openAlertStream } from './handlers/openAlertStream.js';
import { rejectUnknownAction } from './handlers/rejectUnknownAction.js';
import { runAdminCommand } from './handlers/runAdminCommand.js';
import { logSocketEvent } from './middleware/logSocketEvent.js';
import { withAlertContext } from './middleware/withAlertContext.js';
import { StockAlertSchema } from './utils/schemas.js';

export const webSocketRouter = createWebSocketRouter({ middleware: [logSocketEvent] });

webSocketRouter
  .connect({ handler: openAlertStream })
  .disconnect({ handler: closeAlertStream })
  .message({
    routeKey: 'sendAlert',
    bodySchema: StockAlertSchema,
    middleware: [withAlertContext],
    handler: broadcastAlert,
  })
  .route(runAdminCommand)
  .route(rejectUnknownAction);
