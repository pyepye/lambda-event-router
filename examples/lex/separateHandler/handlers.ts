import type {
  LexDialogCodeHookRequest,
  LexFulfillmentCodeHookRequest,
  LexRequest,
  LexResponse,
} from '../../../packages/lex/dist';

// General handler - invocationSource could be either DialogCodeHook or FulfillmentCodeHook
export async function handleOrder({
  intentName,
  slots,
  invocationSource,
  sessionAttributes,
}: LexRequest): Promise<LexResponse> {
  console.log(`Handling ${intentName} (${invocationSource})`);
  console.log(`Slots: ${JSON.stringify(slots)}`);
  console.log(`Session: ${JSON.stringify(sessionAttributes)}`);

  return {
    sessionState: {
      dialogAction: {
        type: 'Delegate',
      },
      intent: {
        name: intentName,
        state: 'InProgress',
      },
    },
  };
}

// Narrowed to DialogCodeHook - validates slots during dialog
export async function validatePizzaOrder({
  intentName,
  slots,
  sessionAttributes,
}: LexDialogCodeHookRequest): Promise<LexResponse> {
  console.log(`Validating ${intentName} - slots: ${JSON.stringify(slots)}`);
  console.log(`Session: ${JSON.stringify(sessionAttributes)}`);

  return {
    sessionState: {
      dialogAction: {
        type: 'Delegate',
      },
      intent: {
        name: intentName,
        state: 'InProgress',
      },
    },
  };
}

// Narrowed to FulfillmentCodeHook - processes the completed intent
export async function fulfillPizzaOrder({
  intentName,
  slots,
  inputTranscript,
}: LexFulfillmentCodeHookRequest): Promise<LexResponse> {
  console.log(`Fulfilling ${intentName} - transcript: ${inputTranscript}`);
  console.log(`Order slots: ${JSON.stringify(slots)}`);

  return {
    sessionState: {
      dialogAction: {
        type: 'Close',
      },
      intent: {
        name: intentName,
        state: 'Fulfilled',
      },
    },
    messages: [
      {
        contentType: 'PlainText',
        content: 'Your pizza order has been placed!',
      },
    ],
  };
}
