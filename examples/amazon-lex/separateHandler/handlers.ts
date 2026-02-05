import type {
  AmazonLexDialogCodeHookRequest,
  AmazonLexFulfillmentCodeHookRequest,
  AmazonLexRequest,
  AmazonLexResponse,
} from '@lambda-event-router/amazon-lex';

// General handler - invocationSource could be either DialogCodeHook or FulfillmentCodeHook
export async function handleOrder({
  intentName,
  slots,
  invocationSource,
  sessionAttributes,
}: AmazonLexRequest): Promise<AmazonLexResponse> {
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
}: AmazonLexDialogCodeHookRequest): Promise<AmazonLexResponse> {
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
}: AmazonLexFulfillmentCodeHookRequest): Promise<AmazonLexResponse> {
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
