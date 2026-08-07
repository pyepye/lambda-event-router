import { type ComplianceType, PutEvaluationsCommand } from '@aws-sdk/client-config-service';
import { logger } from '@lambda-event-router/base';

import { configServiceClient } from '../environment.js';

interface EvaluatedResource {
  resourceType: string;
  resourceId: string;
  configurationItemCaptureTime: string;
}

// Matches both ConfigRequest and ConfigOversizedRequest. Only one of the two items is ever set.
interface ChangeEvaluationRequest {
  resultToken: string;
  configRuleName: string;
  configurationItem?: EvaluatedResource;
  configurationItemSummary?: EvaluatedResource;
}

interface AccountEvaluationRequest {
  resultToken: string;
  configRuleName: string;
  accountId: string;
}

interface Evaluation {
  configRuleName: string;
  resultToken: string;
  resourceType: string;
  resourceId: string;
  orderingTimestamp: Date;
  complianceType: ComplianceType;
  annotation: string;
}

// A custom rule has no result in Config until its function calls PutEvaluations with the event's
// resultToken. Config caps an annotation at 256 characters.
async function putEvaluation(evaluation: Evaluation): Promise<void> {
  await configServiceClient.send(
    new PutEvaluationsCommand({
      ResultToken: evaluation.resultToken,
      Evaluations: [
        {
          ComplianceResourceType: evaluation.resourceType,
          ComplianceResourceId: evaluation.resourceId,
          ComplianceType: evaluation.complianceType,
          Annotation: evaluation.annotation.slice(0, 256),
          OrderingTimestamp: evaluation.orderingTimestamp,
        },
      ],
    }),
  );

  logger.info({
    message: 'Evaluation reported',
    configRuleName: evaluation.configRuleName,
    resourceType: evaluation.resourceType,
    resourceId: evaluation.resourceId,
    complianceType: evaluation.complianceType,
    annotation: evaluation.annotation,
  });
}

export async function reportResourceEvaluation(
  request: ChangeEvaluationRequest,
  complianceType: ComplianceType,
  annotation: string,
): Promise<void> {
  const resource = request.configurationItem ?? request.configurationItemSummary;
  if (!resource) {
    throw new Error(`Rule ${request.configRuleName} delivered no configuration item`);
  }

  await putEvaluation({
    configRuleName: request.configRuleName,
    resultToken: request.resultToken,
    resourceType: resource.resourceType,
    resourceId: resource.resourceId,
    orderingTimestamp: new Date(resource.configurationItemCaptureTime),
    complianceType,
    annotation,
  });
}

// A periodic rule evaluates the account as a whole, which Config names AWS::::Account.
export async function reportAccountEvaluation(
  request: AccountEvaluationRequest,
  complianceType: ComplianceType,
  annotation: string,
): Promise<void> {
  await putEvaluation({
    configRuleName: request.configRuleName,
    resultToken: request.resultToken,
    resourceType: 'AWS::::Account',
    resourceId: request.accountId,
    orderingTimestamp: new Date(),
    complianceType,
    annotation,
  });
}

// An item over 256 KB arrives as a summary with no configuration. These rules need the
// configuration, so they report the resource as not applicable rather than guess.
export async function reportOversized(request: ChangeEvaluationRequest): Promise<void> {
  await reportResourceEvaluation(request, 'NOT_APPLICABLE', 'Configuration item too large to evaluate');
}
