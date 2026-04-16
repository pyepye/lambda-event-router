import { defineRoute, type KafkaFilterInput } from '@lambda-event-router/kafka';
import { z } from 'zod';

import { AUDIT_TOPIC } from '../constants.js';

const AuditValueSchema = z.object({
  action: z.string(),
  resource: z.string(),
  actor: z.string(),
  timestamp: z.string(),
});

// Custom filter that routes based on a Kafka record header
function isComplianceAudit({ headers }: KafkaFilterInput): boolean {
  const auditTypeHeader = headers.find((header) => Object.hasOwn(header, 'auditType'));
  if (!auditTypeHeader) {
    return false;
  }

  // header values should be decoded by the router
  return auditTypeHeader.auditType === 'COMPLIANCE';
}

export const auditRoute = defineRoute({
  filters: {
    topic: AUDIT_TOPIC,
    customFilter: isComplianceAudit,
  },
  valueSchema: AuditValueSchema,
}).handle(async (request) => {
  const { action, resource, actor, timestamp } = request.value;
  console.log(`Compliance audit: ${actor} performed ${action} on ${resource} at ${timestamp}`);
});
