import { defineRoute } from '@lambda-event-router/lex';

// Routes only text-based input - useful for handling text differently from speech/DTMF
export const inputModeRoute = defineRoute({
  filters: {
    inputModes: ['Text'],
  },
}).handle(async ({ intentName, inputTranscript, bot }) => {
  console.log(`Text input for ${intentName} on bot ${bot.id}: ${inputTranscript}`);

  return {
    sessionState: {
      dialogAction: {
        type: 'ElicitSlot',
        slotToElicit: 'PizzaSize',
      },
      intent: {
        name: intentName,
        state: 'InProgress',
      },
    },
    messages: [
      {
        contentType: 'PlainText',
        content: 'What size pizza would you like?',
      },
    ],
  };
});
