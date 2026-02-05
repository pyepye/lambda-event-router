import { createAmazonConnectRouter } from '@lambda-event-router/amazon-connect';
import { EventRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import {
  handleApiCall,
  handleCallbackCall,
  handleChatMessage,
  handleEmailMessage,
  handleInboundCall,
  handleOutboundCall,
  handleTransferCall,
  handleVoiceCall,
} from './handlers.js';

const INSTANCE_ARN = 'arn:aws:connect:us-east-1:123456789012:instance/abcd1234-ef56-gh78-ij90-klmnopqrstuv';

const amazonConnectRouter = createAmazonConnectRouter();

// Using .route() with inline filter objects
amazonConnectRouter.route({
  filters: {
    channels: ['VOICE'],
    initiationMethods: ['INBOUND'],
    instanceArns: [INSTANCE_ARN],
  },
  handler: handleVoiceCall,
});

amazonConnectRouter.route({
  filters: {
    channels: ['CHAT'],
    instanceArns: [INSTANCE_ARN],
  },
  handler: handleChatMessage,
});

// Using convenience methods for channels
amazonConnectRouter.voice({
  filters: {
    instanceArns: [INSTANCE_ARN],
  },
  handler: handleVoiceCall,
});

amazonConnectRouter.chat({
  filters: {
    instanceArns: [INSTANCE_ARN],
  },
  handler: handleChatMessage,
});

amazonConnectRouter.email({
  filters: {
    instanceArns: [INSTANCE_ARN],
  },
  handler: handleEmailMessage,
});

// Using convenience methods for initiation methods
amazonConnectRouter.inbound({
  filters: {
    instanceArns: [INSTANCE_ARN],
  },
  handler: handleInboundCall,
});

amazonConnectRouter.outbound({
  filters: {
    instanceArns: [INSTANCE_ARN],
  },
  handler: handleOutboundCall,
});

amazonConnectRouter.transfer({
  filters: {
    instanceArns: [INSTANCE_ARN],
  },
  handler: handleTransferCall,
});

amazonConnectRouter.callback({
  filters: {
    instanceArns: [INSTANCE_ARN],
  },
  handler: handleCallbackCall,
});

amazonConnectRouter.api({
  filters: {
    instanceArns: [INSTANCE_ARN],
  },
  handler: handleApiCall,
});

const eventRouter = new EventRouter({
  routers: [amazonConnectRouter],
});

export const handler: Handler = eventRouter.handler();
