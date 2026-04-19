export interface ConfigEvent {
  invokingEvent: string;
  ruleParameters: string;
  resultToken: string;
  eventLeftScope: boolean;
  executionRoleArn: string;
  configRuleArn: string;
  configRuleName: string;
  configRuleId: string;
  accountId: string;
  version: string;
}

export type ConfigResponse = undefined;
