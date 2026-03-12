import { LambdaRouter } from '@lambda-event-router/base';
import { type ConnectFilterInput, createConnectRouter } from '@lambda-event-router/connect';
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

const connectRouter = createConnectRouter();

// Using .route() with inline filter objects
connectRouter.route({
  filters: {
    channels: ['VOICE'],
    initiationMethods: ['INBOUND'],
    instanceArns: [INSTANCE_ARN],
  },
  handler: handleVoiceCall,
});

connectRouter.route({
  filters: {
    channels: ['CHAT'],
    instanceArns: [INSTANCE_ARN],
  },
  handler: handleChatMessage,
});

// Using convenience methods for channels
connectRouter.voice({
  filters: {
    instanceArns: [INSTANCE_ARN],
  },
  handler: handleVoiceCall,
});

connectRouter.chat({
  filters: {
    instanceArns: [INSTANCE_ARN],
  },
  handler: handleChatMessage,
});

connectRouter.email({
  filters: {
    instanceArns: [INSTANCE_ARN],
  },
  handler: handleEmailMessage,
});

// Using convenience methods for initiation methods
connectRouter.inbound({
  filters: {
    instanceArns: [INSTANCE_ARN],
  },
  handler: handleInboundCall,
});

connectRouter.outbound({
  filters: {
    instanceArns: [INSTANCE_ARN],
  },
  handler: handleOutboundCall,
});

connectRouter.transfer({
  filters: {
    instanceArns: [INSTANCE_ARN],
  },
  handler: handleTransferCall,
});

connectRouter.callback({
  filters: {
    instanceArns: [INSTANCE_ARN],
  },
  handler: handleCallbackCall,
});

connectRouter.api({
  filters: {
    instanceArns: [INSTANCE_ARN],
  },
  handler: handleApiCall,
});

function isVipCaller({ event }: ConnectFilterInput): boolean {
  const contactAttributes = event.Details.ContactData.Attributes;
  return contactAttributes.customerTier === 'platinum';
}

connectRouter.voice({
  filters: {
    instanceArns: [INSTANCE_ARN],
    customFilter: isVipCaller,
  },
  handler: handleVoiceCall,
});

const lambdaRouter = new LambdaRouter({
  routers: [connectRouter],
});

export const handler: Handler = lambdaRouter.handler();
