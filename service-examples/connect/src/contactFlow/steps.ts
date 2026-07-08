import type { ConnectChannel, ConnectInitiationMethod } from '@lambda-event-router/connect';

import {
  AGENT_HANDOVER_STEP,
  CALLBACK_OFFER_STEP,
  DELIVERY_SLOT,
  DELIVERY_SLOT_STEP,
  FAILED_STEP_PARAMETER,
  FLOW_ERROR_STEP,
  GREET_STEP,
  HIGH_PRIORITY,
  LOOKUP_ORDER_STEP,
  ORDER_REF,
  ORDER_REF_PARAMETER,
  PRIORITY_PARAMETER,
  REFUND_STEP,
  STEP_PARAMETER,
  TRIAGE_STEP,
} from '../utils/constants.js';

export interface Expected {
  // JSON.stringify of the ConnectResponse the router returned, matched on fragments.
  resultIncludes?: string[];
  errorIncludes?: string;
}

// One invocation of the worker, built into a ConnectEvent by scripts/checkRoutes.ts.
export interface RouterStep {
  name: string;
  channel: ConnectChannel;
  initiationMethod: ConnectInitiationMethod;
  parameters?: Record<string, string>;
  attributes?: Record<string, string>;
  instanceArn?: string;
  expected: Expected;
}

export const DEPLOYED_INSTANCE_ARN =
  'arn:aws:connect:eu-west-2:123456789012:instance/11111111-2222-3333-4444-555555555555';

const OTHER_INSTANCE_ARN = 'arn:aws:connect:eu-west-2:123456789012:instance/99999999-8888-7777-6666-555555555555';

function step(name: string, extra: Record<string, string> = {}): Record<string, string> {
  return { [STEP_PARAMETER]: name, ...extra };
}

export const routerSteps: RouterStep[] = [
  {
    name: 'the greeting block reaches greetChatCustomer',
    channel: 'CHAT',
    initiationMethod: 'API',
    parameters: step(GREET_STEP),
    attributes: { orderRef: ORDER_REF },
    expected: { resultIncludes: ['"greetingStatus":"greeted"'] },
  },
  {
    name: 'the order block reaches lookupOrder',
    channel: 'CHAT',
    initiationMethod: 'API',
    parameters: step(LOOKUP_ORDER_STEP, { [ORDER_REF_PARAMETER]: ORDER_REF }),
    expected: { resultIncludes: ['"orderStatus":"dispatched"', `"orderRef":"${ORDER_REF}"`] },
  },
  {
    name: 'the delivery block reaches checkDeliverySlot through the exact instance ARN',
    channel: 'CHAT',
    initiationMethod: 'API',
    parameters: step(DELIVERY_SLOT_STEP),
    expected: { resultIncludes: [`"deliverySlot":"${DELIVERY_SLOT}"`] },
  },
  {
    name: 'the callback block reaches offerCallback through the instance ARN pattern',
    channel: 'CHAT',
    initiationMethod: 'API',
    parameters: step(CALLBACK_OFFER_STEP),
    expected: { resultIncludes: ['"callbackOffered":"true"'] },
  },
  {
    name: 'a high priority order block reaches escalateToSupervisor instead',
    channel: 'CHAT',
    initiationMethod: 'API',
    parameters: step(LOOKUP_ORDER_STEP, {
      [PRIORITY_PARAMETER]: HIGH_PRIORITY,
      [ORDER_REF_PARAMETER]: ORDER_REF,
    }),
    expected: { resultIncludes: [`"escalationTicket":"ESC-${ORDER_REF}"`] },
  },
  {
    name: 'the handover block throws from inside the handler',
    channel: 'CHAT',
    initiationMethod: 'API',
    parameters: step(AGENT_HANDOVER_STEP),
    expected: { errorIncludes: 'No agent is free to take contact' },
  },
  {
    name: 'the error branch reaches recordFlowError',
    channel: 'CHAT',
    initiationMethod: 'API',
    parameters: step(FLOW_ERROR_STEP, { [FAILED_STEP_PARAMETER]: AGENT_HANDOVER_STEP }),
    expected: { resultIncludes: [`"failedStep":"${AGENT_HANDOVER_STEP}"`] },
  },
  {
    name: 'the refund block matches no route',
    channel: 'CHAT',
    initiationMethod: 'API',
    parameters: step(REFUND_STEP),
    expected: { errorIncludes: 'No route matched for Amazon Connect event' },
  },
  {
    name: 'an inbound call reaches answerInboundCall',
    channel: 'VOICE',
    initiationMethod: 'INBOUND',
    expected: { resultIncludes: ['"greeting":"parcel-line-welcome"'] },
  },
  {
    name: 'any other voice contact reaches playHoldAnnouncement',
    channel: 'VOICE',
    initiationMethod: 'API',
    expected: { resultIncludes: ['"announcement":"agents-busy"'] },
  },
  {
    name: 'an email contact reaches readEmailEnquiry',
    channel: 'EMAIL',
    initiationMethod: 'API',
    expected: { resultIncludes: ['"enquiryType":"delivery"'] },
  },
  {
    name: 'an outbound contact reaches dialOutboundSurvey',
    channel: 'CHAT',
    initiationMethod: 'OUTBOUND',
    expected: { resultIncludes: ['"surveyId":"delivery-satisfaction"'] },
  },
  {
    name: 'a transferred contact reaches logTransferredContact',
    channel: 'CHAT',
    initiationMethod: 'TRANSFER',
    expected: { resultIncludes: ['"transferred":"true"'] },
  },
  {
    name: 'a callback contact reaches confirmCallbackBooked',
    channel: 'CHAT',
    initiationMethod: 'CALLBACK',
    expected: { resultIncludes: ['"callbackConfirmed":"true"'] },
  },
  {
    name: 'the triage block reaches triageParcelEnquiry on a TASK contact',
    channel: 'TASK',
    initiationMethod: 'API',
    parameters: step(TRIAGE_STEP),
    expected: { resultIncludes: ['"triageStatus":"triaged"'] },
  },
  {
    name: 'the refund block on a TASK contact matches no route',
    channel: 'TASK',
    initiationMethod: 'API',
    parameters: step(REFUND_STEP),
    expected: { errorIncludes: 'No route matched for Amazon Connect event (channel: TASK' },
  },
  {
    name: 'a chat contact is outside the task route',
    channel: 'CHAT',
    initiationMethod: 'API',
    parameters: step(TRIAGE_STEP),
    expected: { errorIncludes: 'No route matched for Amazon Connect event (channel: CHAT' },
  },
  {
    name: 'another instance is outside the exact instance ARN filter',
    channel: 'CHAT',
    initiationMethod: 'API',
    instanceArn: OTHER_INSTANCE_ARN,
    parameters: step(DELIVERY_SLOT_STEP),
    expected: { errorIncludes: 'No route matched for Amazon Connect event' },
  },
];

// What the task flow stores, asserted by scripts/trigger.ts after the task contact ends.
export const expectedTaskAttributes: Record<string, string> = {
  triageStatus: 'triaged',
};

// What the chat flow stores as contact attributes, asserted by scripts/trigger.ts after it ends.
export const expectedAttributes: Record<string, string> = {
  greetingStatus: 'greeted',
  orderStatus: 'dispatched',
  deliverySlot: DELIVERY_SLOT,
  callbackOffered: 'true',
  escalationTicket: `ESC-${ORDER_REF}`,
  handoverError: AGENT_HANDOVER_STEP,
  unroutedError: REFUND_STEP,
};
