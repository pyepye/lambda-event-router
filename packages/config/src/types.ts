export interface ConfigEvent {
  invokingEvent: string;
  ruleParameters?: string; // Left out when the rule has no parameters
  resultToken: string;
  eventLeftScope: boolean;
  executionRoleArn: string;
  configRuleArn: string;
  configRuleName: string;
  configRuleId: string;
  accountId: string;
  version: string;
  evaluationMode: string;
}

export type ConfigResponse = undefined;
