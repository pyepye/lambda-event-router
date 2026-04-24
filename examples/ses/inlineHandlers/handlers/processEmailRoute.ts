import { defineRoute, type SESFilterInput } from '@lambda-event-router/ses';

// Route matching emails to specific recipients with security verdicts
export const inboundEmailRoute = defineRoute({
  filters: {
    recipient: ['support@example.com', 'help@example.com'],
    spamVerdict: 'PASS',
    virusVerdict: 'PASS',
  },
}).handle(async (request) => {
  const { source, subject, recipients } = request;
  console.log(`Inbound email from ${source} to ${recipients.join(', ')}: ${subject}`);
});

// Route matching emails from specific senders with failed SPF (e.g. forwarded mail)
export const partnerEmailRoute = defineRoute({
  filters: {
    sender: ['notifications@partner.com', 'alerts@partner.com'],
    spfVerdict: 'FAIL',
    dkimVerdict: 'PASS',
  },
}).handle(async (request) => {
  const { source, subject } = request;
  console.log(`Partner email from ${source}: ${subject}`);
});

// Route matching emails by domain
export const internalEmailRoute = defineRoute({
  filters: {
    sender: '*@internal.example.com',
    recipient: '*@example.com',
    dmarcVerdict: 'PASS',
  },
}).handle(async (request) => {
  const { source, subject, recipients } = request;
  console.log(`Internal email from ${source} to ${recipients.join(', ')}: ${subject}`);
});

// Route matching emails with attachments using customFilter
export const attachmentEmailRoute = defineRoute({
  filters: {
    recipient: 'uploads@example.com',
    spamVerdict: 'PASS',
    virusVerdict: 'PASS',
    customFilter: ({ mail }: SESFilterInput) => {
      const hasAttachments = mail.commonHeaders.to !== undefined;
      const headerCount = mail.headers.length;
      return hasAttachments && headerCount > 5;
    },
  },
}).handle(async (request) => {
  const { source, subject } = request;
  console.log(`Email with attachments from ${source}: ${subject}`);
});
