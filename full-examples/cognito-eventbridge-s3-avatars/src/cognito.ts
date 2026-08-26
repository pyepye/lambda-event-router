import { createCognitoRouter } from '@lambda-event-router/cognito';

import { customMessageUpdateAttribute } from './cognito-handlers/customMessageUpdateAttribute.js';
import { keepDefaultMessage } from './cognito-handlers/keepDefaultMessage.js';
import { postConfirmation } from './cognito-handlers/postConfirmation.js';

export const cognitoRouter = createCognitoRouter();

// Cognito sends every CustomMessage source to this Lambda. The customMessage route catches the ones
// with no route of their own, and the router ranks it behind customMessageUpdateUserAttribute.
cognitoRouter
  .postConfirmationConfirmSignUp({ handler: postConfirmation })
  .customMessageUpdateUserAttribute({ handler: customMessageUpdateAttribute })
  .customMessage({ handler: keepDefaultMessage });
