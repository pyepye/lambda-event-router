import { z } from 'zod';

import { defineRoute } from '@lambda-event-router/config';

const keyRotationParamsSchema = z.object({
  maxKeyAge: z.string(), // max age in days before non-compliant
  exemptKeyIds: z.string().optional(), // JSON-encoded array of exempt key IDs
});

// ConfigurationItemChangeNotification with Zod validation on ruleParameters
export const kmsKeyRotationRoute = defineRoute({
  filters: {
    configRuleName: 'kms-key-rotation-check',
    resourceType: 'AWS::KMS::Key',
    configurationItemStatus: ['OK', 'ResourceDiscovered'],
  },
  ruleParametersSchema: keyRotationParamsSchema,
}).handle(async ({ configurationItem, ruleParameters }) => {
  // ruleParameters is typed as z.infer<typeof keyRotationParamsSchema>
  const maxKeyAge = Number.parseInt(ruleParameters.maxKeyAge, 10);
  if (!configurationItem) return;
  const { resourceId, configuration } = configurationItem;
  const isRotationEnabled = configuration.keyRotationEnabled === true;

  console.log(`KMS key ${resourceId}: rotation=${isRotationEnabled}, maxAge=${maxKeyAge} days`);
});

// Configuration schemas vary per resource type. See the AWS Config Resource Type Reference
// for the full schema of each supported resource: https://docs.aws.amazon.com/config/latest/developerguide/resource-config-reference.html
const elbConfigurationSchema = z.object({
  loadBalancerName: z.string(),
  scheme: z.enum(['internet-facing', 'internal']),
  securityGroups: z.array(z.string()),
  listeners: z.array(
    z.object({
      protocol: z.string(),
      port: z.number(),
    }),
  ),
});

// ConfigurationItemChangeNotification with Zod validation on configuration
export const elbListenerRoute = defineRoute({
  filters: {
    configRuleName: 'elb-https-listener-check',
    resourceType: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
  },
  configurationSchema: elbConfigurationSchema,
}).handle(async ({ configurationItem }) => {
  if (!configurationItem) return;
  // configurationItem.configuration is typed as z.infer<typeof elbConfigurationSchema>
  const { configuration, resourceId } = configurationItem;
  const hasHttpsListener = configuration.listeners.some(
    (listener: { protocol: string }) => listener.protocol === 'HTTPS',
  );

  console.log(`ELB ${resourceId} (${configuration.loadBalancerName}): scheme=${configuration.scheme}`);
  console.log(`HTTPS listener present: ${hasHttpsListener}`);
});

// OversizedConfigurationItemChangeNotification route
export const oversizedRdsRoute = defineRoute({
  filters: {
    resourceType: 'AWS::RDS::DBInstance',
    configurationItemStatus: 'OK',
  },
  ruleParametersSchema: keyRotationParamsSchema,
}).handle(async ({ configurationItemSummary, ruleParameters, resultToken }) => {
  if (!configurationItemSummary) return;
  const { resourceType, resourceId } = configurationItemSummary;

  console.log(`Oversized: ${resourceType} ${resourceId}`);
  console.log(`Max key age: ${ruleParameters.maxKeyAge}`);
  console.log(`Result token: ${resultToken}`);
});
