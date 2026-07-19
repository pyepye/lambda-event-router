import { BinaryBody, createALBRouter } from '@lambda-event-router/alb';

import { amendReturn } from './handlers/amendReturn.js';
import { amendReturnAtDesk } from './handlers/amendReturnAtDesk.js';
import { checkReturn } from './handlers/checkReturn.js';
import { checkReturnPickup } from './handlers/checkReturnPickup.js';
import { countOpenReturns } from './handlers/countOpenReturns.js';
import { createReturn } from './handlers/createReturn.js';
import { describeReturn } from './handlers/describeReturn.js';
import { exportReturnLabels } from './handlers/exportReturnLabels.js';
import { exportReturnsCsv } from './handlers/exportReturnsCsv.js';
import { getReturn } from './handlers/getReturn.js';
import { getReturnLabel } from './handlers/getReturnLabel.js';
import { getReturnLine } from './handlers/getReturnLine.js';
import { listCarrierReturns } from './handlers/listCarrierReturns.js';
import { listOpenReturns } from './handlers/listOpenReturns.js';
import { redirectMergedReturn } from './handlers/redirectMergedReturn.js';
import { refundReturn } from './handlers/refundReturn.js';
import { releaseReturnHold } from './handlers/releaseReturnHold.js';
import { replaceReturnNote } from './handlers/replaceReturnNote.js';
import { summariseReturnQueue } from './handlers/summariseReturnQueue.js';
import { summariseReturns } from './handlers/summariseReturns.js';
import { withdrawReturn } from './handlers/withdrawReturn.js';
import { logRequest } from './middleware/logRequest.js';
import { withDeskClosure } from './middleware/withDeskClosure.js';
import { withReturnContext } from './middleware/withReturnContext.js';
import { ALLOWED_ORIGIN_SUFFIX, CHANNEL_HEADER, DESK_HEADER, RETURN_VERSION_HEADER } from './utils/constants.js';
import { NewReturnSchema, OpenReturnsSchema, ReturnAmendmentSchema } from './utils/schemas.js';

const PREFLIGHT_MAX_AGE_SECONDS = 600;

export const returnsRouter = createALBRouter({
  middleware: [logRequest],
  cors: {
    origin: (origin) => (origin.endsWith(ALLOWED_ORIGIN_SUFFIX) ? origin : undefined),
    allowedHeaders: ['content-type', CHANNEL_HEADER, DESK_HEADER],
    exposedHeaders: [RETURN_VERSION_HEADER],
    credentials: true,
    maxAge: PREFLIGHT_MAX_AGE_SECONDS,
  },
});

// The router ranks routes itself, which is why /returns/open is reached despite being registered after
// /returns/:returnId, and why amendReturnAtDesk's custom filter is asked before amendReturn takes the
// same method and path.
returnsRouter
  .route(amendReturnAtDesk)
  .patch({ filters: { path: '/returns/:returnId' }, bodySchema: ReturnAmendmentSchema, handler: amendReturn })
  .route(getReturn)
  .get({ filters: { path: '/returns/open' }, responseSchema: OpenReturnsSchema, handler: listOpenReturns })
  .head({ filters: { path: '/returns/:returnId' }, handler: checkReturn })
  .options({ filters: { path: '/returns/:returnId' }, handler: describeReturn })
  .post({ filters: { path: '/returns' }, bodySchema: NewReturnSchema, handler: createReturn })
  .put({
    filters: { path: '/returns/:returnId/note' },
    middleware: [withDeskClosure, withReturnContext],
    bodySchema: BinaryBody,
    handler: replaceReturnNote,
  })
  .delete({ filters: { path: '/returns/:returnId' }, handler: withdrawReturn })
  .route(redirectMergedReturn)
  .route(getReturnLine)
  .route(getReturnLabel)
  .route(checkReturnPickup)
  .route(releaseReturnHold)
  .route(listCarrierReturns)
  .route(summariseReturns)
  .route(summariseReturnQueue)
  .route(countOpenReturns)
  .route(exportReturnsCsv)
  .route(exportReturnLabels)
  .route(refundReturn);
