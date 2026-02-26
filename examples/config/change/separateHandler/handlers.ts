import type { ConfigOversizedRequest, ConfigRequest } from '@lambda-event-router/config';

export async function handleIamRoleCompliance({
  configurationItem,
  ruleParameters,
  resultToken,
  configRuleName,
}: ConfigRequest): Promise<void> {
  const { resourceType, resourceId, configuration, tags } = configurationItem;

  const requiredTagsParam = ruleParameters.requiredTags ?? '[]';
  const requiredTags = JSON.parse(requiredTagsParam);
  const missingTags = requiredTags.filter((tag: string) => !Object.hasOwn(tags, tag));
  const isCompliant = missingTags.length === 0;

  console.log(
    `Rule ${configRuleName}: ${resourceType} ${resourceId} is ${isCompliant ? 'COMPLIANT' : 'NON_COMPLIANT'}`,
  );
  console.log(`IAM role path: ${configuration.path}`);
  console.log(`Result token: ${resultToken}`);
}

export async function handleRdsEncryptionCheck({ configurationItem, resultToken }: ConfigRequest): Promise<void> {
  const { resourceId, configuration } = configurationItem;

  const isEncrypted = configuration.storageEncrypted === true;
  const engineVersion = configuration.engineVersion;

  console.log(`RDS instance ${resourceId}: encrypted=${isEncrypted}, engine=${engineVersion}`);
  console.log(`Result token: ${resultToken}`);
}

export async function handleResourceDeleted({
  configurationItem,
  configRuleName,
  resultToken,
}: ConfigRequest): Promise<void> {
  const { resourceType, resourceId } = configurationItem;
  console.log(`Rule ${configRuleName}: ${resourceType} ${resourceId} was deleted`);
  console.log(`Result token: ${resultToken}`);
}

// OversizedConfigurationItemChangeNotification handler
// configurationItemSummary is provided instead of full configurationItem
export async function handleOversizedLambdaCompliance({
  configurationItemSummary,
  ruleParameters,
  resultToken,
}: ConfigOversizedRequest): Promise<void> {
  const { resourceType, resourceId, configurationItemStatus } = configurationItemSummary;

  console.log(`Oversized config for ${resourceType} ${resourceId} (status: ${configurationItemStatus})`);
  console.log(`Rule parameters: ${JSON.stringify(ruleParameters)}`);
  console.log(`Result token: ${resultToken}`);

  // For oversized items, use AWS Config API to fetch full configuration
  // const configService = new ConfigServiceClient({});
  // const fullConfig = await configService.send(new GetResourceConfigHistoryCommand({ ... }));
}
