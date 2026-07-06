import type { LexInputMode, LexInvocationSource } from '@lambda-event-router/lex';

import {
  BOOK_REDELIVERY_INTENT,
  CANCEL_DELIVERY_INTENT,
  FALLBACK_INTENT,
  PRIORITY_TIER,
  SPEAK_TO_AGENT_INTENT,
  TRACK_PARCEL_INTENT,
  TRACKING_NUMBER_SLOT,
} from '../utils/constants.js';

export interface Expected {
  // JSON.stringify of the LexV2Result the router returned, matched on fragments.
  resultIncludes?: string[];
  errorIncludes?: string;
}

// One invocation of the worker, built into a LexV2Event by scripts/checkRoutes.ts.
export interface RouterStep {
  name: string;
  intentName: string;
  invocationSource: LexInvocationSource;
  inputMode?: LexInputMode;
  botId?: string;
  trackingNumber?: string;
  sessionAttributes?: Record<string, string>;
  expected: Expected;
}

export const DEPLOYED_BOT_ID = 'LERLEXBOT1';

export const routerSteps: RouterStep[] = [
  {
    name: 'opening tracking turn reaches checkTrackingNumber',
    intentName: TRACK_PARCEL_INTENT,
    invocationSource: 'DialogCodeHook',
    expected: { resultIncludes: ['What is the tracking number?', '"type":"ElicitSlot"'] },
  },
  {
    name: 'malformed tracking number is re-elicited',
    intentName: TRACK_PARCEL_INTENT,
    invocationSource: 'DialogCodeHook',
    trackingNumber: 'XY12',
    expected: { resultIncludes: ['does not look right', `"${TRACKING_NUMBER_SLOT}":null`] },
  },
  {
    name: 'valid tracking number delegates back to Lex',
    intentName: TRACK_PARCEL_INTENT,
    invocationSource: 'DialogCodeHook',
    trackingNumber: 'AB123456',
    expected: { resultIncludes: ['"type":"Delegate"'] },
  },
  {
    name: 'tracking fulfilment reaches reportParcelLocation',
    intentName: TRACK_PARCEL_INTENT,
    invocationSource: 'FulfillmentCodeHook',
    trackingNumber: 'AB123456',
    expected: { resultIncludes: ['out for delivery in Leeds', '"state":"Fulfilled"'] },
  },
  {
    name: 'cancellation dialog turn reaches checkTrackingNumber through the intent list',
    intentName: CANCEL_DELIVERY_INTENT,
    invocationSource: 'DialogCodeHook',
    expected: { resultIncludes: ['What is the tracking number?'] },
  },
  {
    name: 'cancellation fulfilment reaches cancelDelivery through the wildcard',
    intentName: CANCEL_DELIVERY_INTENT,
    invocationSource: 'FulfillmentCodeHook',
    trackingNumber: 'CD987654',
    expected: { resultIncludes: ['Delivery CD987654 is cancelled.'] },
  },
  {
    name: 'redelivery fulfilment reaches bookRedelivery',
    intentName: BOOK_REDELIVERY_INTENT,
    invocationSource: 'FulfillmentCodeHook',
    expected: { resultIncludes: ['Your redelivery is booked for tomorrow.'] },
  },
  {
    name: 'a priority account takes the same utterance to escalateToSupervisor',
    intentName: BOOK_REDELIVERY_INTENT,
    invocationSource: 'FulfillmentCodeHook',
    sessionAttributes: { accountTier: PRIORITY_TIER },
    expected: { resultIncludes: ['A supervisor will call you back within the hour.'] },
  },
  {
    name: 'agent handover throws from inside the handler',
    intentName: SPEAK_TO_AGENT_INTENT,
    invocationSource: 'FulfillmentCodeHook',
    expected: { errorIncludes: 'No agent is free to take' },
  },
  {
    name: 'the fallback intent matches no route',
    intentName: FALLBACK_INTENT,
    invocationSource: 'FulfillmentCodeHook',
    expected: { errorIncludes: 'No route matched for Amazon Lex event' },
  },
  {
    name: 'a DTMF redelivery turn is outside the inputMode filter',
    intentName: BOOK_REDELIVERY_INTENT,
    invocationSource: 'FulfillmentCodeHook',
    inputMode: 'DTMF',
    expected: { errorIncludes: 'No route matched for Amazon Lex event' },
  },
  {
    name: 'a redelivery turn from another bot is outside the botId filter',
    intentName: BOOK_REDELIVERY_INTENT,
    invocationSource: 'FulfillmentCodeHook',
    botId: 'SOMEOTHERBOT',
    expected: { errorIncludes: 'No route matched for Amazon Lex event' },
  },
];

// One RecognizeText call, sent by scripts/trigger.ts. Steps sharing a conversation run in order.
export interface ConversationStep {
  name: string;
  conversation: string;
  text: string;
  sessionAttributes?: Record<string, string>;
  expected: {
    messageIncludes?: string;
    intentName?: string;
    intentState?: string;
    dialogActionType?: string;
  };
}

export const conversationSteps: ConversationStep[] = [
  {
    name: 'asking to track a parcel elicits the tracking number',
    conversation: 'tracking',
    text: 'track my parcel',
    expected: {
      messageIncludes: 'What is the tracking number?',
      intentName: TRACK_PARCEL_INTENT,
      dialogActionType: 'ElicitSlot',
    },
  },
  {
    name: 'a malformed tracking number is asked for again',
    conversation: 'tracking',
    text: 'XY12',
    expected: { messageIncludes: 'does not look right', dialogActionType: 'ElicitSlot' },
  },
  {
    name: 'a valid tracking number runs the dialog hook then the fulfilment hook',
    conversation: 'tracking',
    text: 'AB123456',
    expected: {
      messageIncludes: 'out for delivery in Leeds',
      intentState: 'Fulfilled',
      dialogActionType: 'Close',
    },
  },
  {
    name: 'asking to cancel a delivery elicits the tracking number',
    conversation: 'cancellation',
    text: 'cancel my delivery',
    expected: {
      messageIncludes: 'What is the tracking number?',
      intentName: CANCEL_DELIVERY_INTENT,
      dialogActionType: 'ElicitSlot',
    },
  },
  {
    name: 'a valid tracking number cancels the delivery',
    conversation: 'cancellation',
    text: 'CD987654',
    expected: { messageIncludes: 'is cancelled', intentState: 'Fulfilled', dialogActionType: 'Close' },
  },
  {
    name: 'booking a redelivery goes straight to fulfilment',
    conversation: 'redelivery',
    text: 'book a redelivery',
    expected: {
      messageIncludes: 'booked for tomorrow',
      intentName: BOOK_REDELIVERY_INTENT,
      intentState: 'Fulfilled',
    },
  },
  {
    name: 'the same utterance on a priority account is escalated instead',
    conversation: 'priority',
    text: 'book a redelivery',
    sessionAttributes: { accountTier: PRIORITY_TIER },
    expected: {
      messageIncludes: 'A supervisor will call you back',
      intentName: BOOK_REDELIVERY_INTENT,
      intentState: 'Fulfilled',
    },
  },
  {
    name: 'a handler that throws fails the intent',
    conversation: 'handover',
    text: 'speak to an agent',
    expected: {
      messageIncludes: 'could not put you through',
      intentName: SPEAK_TO_AGENT_INTENT,
      intentState: 'Failed',
    },
  },
  {
    name: 'an unrecognised utterance matches no route and fails the intent',
    conversation: 'fallback',
    text: 'what is the capital of France',
    expected: {
      messageIncludes: 'did not understand',
      intentName: FALLBACK_INTENT,
      intentState: 'Failed',
    },
  },
];
