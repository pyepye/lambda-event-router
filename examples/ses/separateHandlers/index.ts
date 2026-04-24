import type { Handler } from 'aws-lambda';

import { LambdaRouter } from '@lambda-event-router/base';
import { createSESRouter, type SESFilterInput } from '@lambda-event-router/ses';

import {
  processInboundEmail,
  processInternalEmail,
  processPartnerEmail,
  processQuarantinedEmail,
} from './handlers/processEmail.js';

const sesRouter = createSESRouter();

// Route matching emails to specific recipients with security verdicts
sesRouter.route({
  filters: {
    recipient: ['support@example.com', 'help@example.com'],
    spamVerdict: 'PASS',
    virusVerdict: 'PASS',
  },
  handler: processInboundEmail,
});

// Route matching emails from specific senders with failed SPF (e.g. forwarded mail)
sesRouter.route({
  filters: {
    sender: ['notifications@partner.com', 'alerts@partner.com'],
    spfVerdict: 'FAIL',
    dkimVerdict: 'PASS',
  },
  handler: processPartnerEmail,
});

// Route matching emails by domain with DMARC verification
sesRouter.route({
  filters: {
    sender: '*@internal.example.com',
    recipient: '*@example.com',
    dmarcVerdict: 'PASS',
  },
  handler: processInternalEmail,
});

function isQuarantined({ receipt }: SESFilterInput): boolean {
  const spamFailed = receipt.spamVerdict.status === 'FAIL';
  const virusFailed = receipt.virusVerdict.status === 'FAIL';
  return spamFailed || virusFailed;
}

// Route with customFilter for complex logic
sesRouter.route({
  filters: {
    recipient: '*@example.com',
    customFilter: isQuarantined,
  },
  handler: processQuarantinedEmail,
});

const lambdaRouter = new LambdaRouter({
  routers: [sesRouter],
});

export const handler: Handler = lambdaRouter.handler();
