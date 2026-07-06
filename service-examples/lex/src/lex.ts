import { createLexRouter } from '@lambda-event-router/lex';

import { bookRedelivery } from './handlers/bookRedelivery.js';
import { cancelDelivery } from './handlers/cancelDelivery.js';
import { checkTrackingNumber } from './handlers/checkTrackingNumber.js';
import { escalateToSupervisor } from './handlers/escalateToSupervisor.js';
import { handOverToAgent } from './handlers/handOverToAgent.js';
import { reportParcelLocation } from './handlers/reportParcelLocation.js';
import { logTurn } from './middleware/logTurn.js';
import { withAccountContext } from './middleware/withAccountContext.js';
import { CANCEL_DELIVERY_INTENT, PRIORITY_TIER, TRACK_PARCEL_INTENT } from './utils/constants.js';
import { readAccountTier } from './utils/parcels.js';

export const lexRouter = createLexRouter({ middleware: [logTurn] });

// Order matters: escalateToSupervisor takes every fulfilment turn on a priority account, so it is
// registered ahead of the intent routes that would otherwise claim those turns.
lexRouter
  .fulfillmentCodeHook({
    filters: {
      custom: async ({ event }) =>
        (await readAccountTier(event.sessionState.sessionAttributes ?? {})) === PRIORITY_TIER,
    },
    middleware: [withAccountContext],
    handler: escalateToSupervisor,
  })
  .dialogCodeHook({
    filters: { intentName: [TRACK_PARCEL_INTENT, CANCEL_DELIVERY_INTENT] },
    handler: checkTrackingNumber,
  })
  .fulfillmentCodeHook({
    filters: { intentName: TRACK_PARCEL_INTENT },
    handler: reportParcelLocation,
  })
  .route(cancelDelivery)
  .route(bookRedelivery)
  .route(handOverToAgent);
