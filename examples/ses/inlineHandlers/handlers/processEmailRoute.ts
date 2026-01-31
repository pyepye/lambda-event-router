import { defineRoute } from '@lambda-event-router/ses';

// Route matching emails to specific recipients with security verdicts
export const inboundEmailRoute = defineRoute({
  filters: {
    recipients: ['support@example.com', 'help@example.com'],
    spamVerdict: ['PASS'],
    virusVerdict: ['PASS'],
  },
}).handle(async (request) => {
  const { source, subject, recipients } = request;
  console.log(`Inbound email from ${source} to ${recipients.join(', ')}: ${subject}`);
});

// Route matching emails from specific senders with failed SPF (e.g. forwarded mail)
export const partnerEmailRoute = defineRoute({
  filters: {
    senders: ['notifications@partner.com', 'alerts@partner.com'],
    spfVerdict: ['FAIL'],
    dkimVerdict: ['PASS'],
  },
}).handle(async (request) => {
  const { source, subject } = request;
  console.log(`Partner email from ${source}: ${subject}`);
});

// Route matching emails by domain
export const internalEmailRoute = defineRoute({
  filters: {
    senderDomains: ['internal.example.com'],
    recipientDomains: ['example.com'],
    dmarcVerdict: ['PASS'],
  },
}).handle(async (request) => {
  const { source, subject, recipients } = request;
  console.log(`Internal email from ${source} to ${recipients.join(', ')}: ${subject}`);
});
