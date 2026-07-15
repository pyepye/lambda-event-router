import type { ConfigOversizedRequest, ConfigRequest } from '@lambda-event-router/config';

// A rule's filters cannot tell a normal change from an oversized one, so every handler is given both
// and narrows on configurationItem, which only the normal shape carries
type ConfigChangeRequest = ConfigRequest | ConfigOversizedRequest;

export async function handleIamRoleCompliance(request: ConfigChangeRequest): Promise<void> {
  const { configurationItem, ruleParameters, resultToken, configRuleName } = request;
  if (!configurationItem) {
    console.log(`Rule ${configRuleName}: change too large to inline, fetch it from the Config API`);
    return;
  }

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

export async function handleRdsEncryptionCheck(request: ConfigChangeRequest): Promise<void> {
  const { configurationItem, resultToken } = request;
  if (!configurationItem) {
    console.log(`Change too large to inline, fetch it from the Config API. Result token: ${resultToken}`);
    return;
  }

  const { resourceId, configuration } = configurationItem;

  const isEncrypted = configuration.storageEncrypted === true;
  const engineVersion = configuration.engineVersion;

  console.log(`RDS instance ${resourceId}: encrypted=${isEncrypted}, engine=${engineVersion}`);
  console.log(`Result token: ${resultToken}`);
}

export async function handleResourceDeleted(request: ConfigChangeRequest): Promise<void> {
  const { configurationItem, configRuleName, resultToken } = request;
  if (!configurationItem) {
    console.log(`Rule ${configRuleName}: deletion too large to inline, fetch it from the Config API`);
    return;
  }

  const { resourceType, resourceId } = configurationItem;
  console.log(`Rule ${configRuleName}: ${resourceType} ${resourceId} was deleted`);
  console.log(`Result token: ${resultToken}`);
}

// The oversized notification carries configurationItemSummary in place of the full configurationItem
export async function handleOversizedLambdaCompliance(request: ConfigChangeRequest): Promise<void> {
  const { configurationItemSummary, ruleParameters, resultToken } = request;
  if (!configurationItemSummary) {
    console.log(`Change small enough to inline, read it off configurationItem. Result token: ${resultToken}`);
    return;
  }

  const { resourceType, resourceId, configurationItemStatus } = configurationItemSummary;

  console.log(`Oversized config for ${resourceType} ${resourceId} (status: ${configurationItemStatus})`);
  console.log(`Rule parameters: ${JSON.stringify(ruleParameters)}`);
  console.log(`Result token: ${resultToken}`);

  // For oversized items, use AWS Config API to fetch full configuration
  // const configService = new ConfigServiceClient({});
  // const fullConfig = await configService.send(new GetResourceConfigHistoryCommand({ ... }));
}
