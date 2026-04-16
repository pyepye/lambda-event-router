import { defineConfigScheduledRoute } from '@lambda-event-router/config';
import { z } from 'zod';

const tagAuditParamsSchema = z.object({
  requiredTags: z.string(), // JSON-encoded array of tag names
  resourceTypes: z.string(), // JSON-encoded array of resource types to audit
});

export const tagAuditRoute = defineConfigScheduledRoute({
  filters: {
    configRuleName: 'periodic-tag-audit',
  },
  ruleParametersSchema: tagAuditParamsSchema,
}).handle(async ({ resultToken, configRuleName, accountId, ruleParameters }) => {
  // ruleParameters is typed as z.infer<typeof tagAuditParamsSchema>
  const requiredTags = JSON.parse(ruleParameters.requiredTags);
  const resourceTypes = JSON.parse(ruleParameters.resourceTypes);

  console.log(`Scheduled audit: rule=${configRuleName}, account=${accountId}`);
  console.log(`Required tags: ${requiredTags}, resource types: ${resourceTypes}`);
  console.log(`Result token: ${resultToken}`);
});

export const crossAccountRoute = defineConfigScheduledRoute({
  filters: {
    configRuleName: 'cross-account-access-check',
    accountId: ['123456789012', '987654321098'],
  },
}).handle(async ({ resultToken, configRuleName, accountId, ruleParameters }) => {
  console.log(`Cross-account check: rule=${configRuleName}, account=${accountId}`);
  console.log(`Rule parameters: ${JSON.stringify(ruleParameters)}`);
  console.log(`Result token: ${resultToken}`);
});
