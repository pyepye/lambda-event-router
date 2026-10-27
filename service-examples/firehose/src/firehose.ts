import { createFirehoseMatcher } from '@latcher/firehose';

import { archiveAuditEvent } from './handlers/archiveAuditEvent.js';
import { dropHealthCheckPing } from './handlers/dropHealthCheckPing.js';
import { quarantineBotTraffic } from './handlers/quarantineBotTraffic.js';
import { recordPageView } from './handlers/recordPageView.js';
import { redactVisitorEmail } from './handlers/redactVisitorEmail.js';
import { logRecord } from './middleware/logRecord.js';

export const firehoseMatcher = createFirehoseMatcher({ middleware: [logRecord] });

// Order matters: quarantineBotTraffic reads the user agent whatever the event type is, so it has to be
// registered before recordPageView for a page view from a bot to reach it.
firehoseMatcher
  .route(dropHealthCheckPing)
  .route(quarantineBotTraffic)
  .route(redactVisitorEmail)
  .route(recordPageView)
  .route(archiveAuditEvent);
