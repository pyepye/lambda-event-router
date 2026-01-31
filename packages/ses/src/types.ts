import type { Context, SESEventRecord, SESMail, SESReceipt } from 'aws-lambda';

export type SESReceiptStatusValue = 'PASS' | 'FAIL' | 'GRAY' | 'PROCESSING_FAILED' | 'DISABLED';

export interface SESRequest {
  source: string;
  subject: string | undefined;
  recipients: string[];
  receipt: SESReceipt;
  mail: SESMail;
  record: SESEventRecord;
  context: Context;
}

export type SESResponse = undefined;

export type SESRecordHandler = (request: SESRequest) => Promise<void>;

export interface SESFilterInput {
  receipt: SESReceipt;
  mail: SESMail;
}

export interface SESFilters {
  recipients?: string[];
  senders?: string[];
  senderDomains?: string[];
  recipientDomains?: string[];
  spamVerdict?: SESReceiptStatusValue[];
  virusVerdict?: SESReceiptStatusValue[];
  spfVerdict?: SESReceiptStatusValue[];
  dkimVerdict?: SESReceiptStatusValue[];
  dmarcVerdict?: SESReceiptStatusValue[];
  customFilter?: (input: SESFilterInput) => boolean;
}

export interface SESRouteDefinition {
  filters: SESFilters;
  handler: SESRecordHandler;
}
