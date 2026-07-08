import { createConnectRouter } from '@lambda-event-router/connect';

import { answerInboundCall } from './handlers/answerInboundCall.js';
import { checkDeliverySlot } from './handlers/checkDeliverySlot.js';
import { confirmCallbackBooked } from './handlers/confirmCallbackBooked.js';
import { dialOutboundSurvey } from './handlers/dialOutboundSurvey.js';
import { escalateToSupervisor } from './handlers/escalateToSupervisor.js';
import { failAgentHandover } from './handlers/failAgentHandover.js';
import { greetChatCustomer } from './handlers/greetChatCustomer.js';
import { logTransferredContact } from './handlers/logTransferredContact.js';
import { lookupOrder } from './handlers/lookupOrder.js';
import { offerCallback } from './handlers/offerCallback.js';
import { playHoldAnnouncement } from './handlers/playHoldAnnouncement.js';
import { readEmailEnquiry } from './handlers/readEmailEnquiry.js';
import { recordFlowError } from './handlers/recordFlowError.js';
import { triageParcelEnquiry } from './handlers/triageParcelEnquiry.js';
import { logContact } from './middleware/logContact.js';
import { atStep } from './utils/atStep.js';
import { GREET_STEP, LOOKUP_ORDER_STEP, TRIAGE_STEP } from './utils/constants.js';

export const connectRouter = createConnectRouter({ middleware: [logContact] });

// Order matters twice. escalateToSupervisor takes every high priority contact whatever step it asks
// for, so it is registered ahead of the step routes that would otherwise claim it. answerInboundCall
// sits ahead of playHoldAnnouncement, which is the voice route with no other filter on it.
connectRouter
  .route(escalateToSupervisor)
  .chat({
    filters: { initiationMethod: 'API', custom: atStep(GREET_STEP) },
    handler: greetChatCustomer,
  })
  .api({
    filters: { channel: ['VOICE', 'CHAT'], custom: atStep(LOOKUP_ORDER_STEP) },
    handler: lookupOrder,
  })
  .route(checkDeliverySlot)
  .route(offerCallback)
  .route(failAgentHandover)
  .route(recordFlowError)
  .task({ filters: { custom: atStep(TRIAGE_STEP) }, handler: triageParcelEnquiry })
  .inbound({ filters: { channel: 'VOICE' }, handler: answerInboundCall })
  .outbound({ filters: {}, handler: dialOutboundSurvey })
  .transfer({ filters: {}, handler: logTransferredContact })
  .callback({ filters: {}, handler: confirmCallbackBooked })
  .email({ filters: {}, handler: readEmailEnquiry })
  .voice({ filters: {}, handler: playHoldAnnouncement });
