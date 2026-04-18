import type { Middleware } from '@lambda-event-router/base';
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

export type SESMiddleware = Middleware<SESRequest, void>;

export type SESRecordHandler = (request: SESRequest) => Promise<void>;

export interface SESFilterInput {
  receipt: SESReceipt;
  mail: SESMail;
}

export interface SESFilters {
  recipient?: string | string[];
  sender?: string | string[];
  senderDomain?: string | string[];
  recipientDomain?: string | string[];
  spamVerdict?: SESReceiptStatusValue | SESReceiptStatusValue[];
  virusVerdict?: SESReceiptStatusValue | SESReceiptStatusValue[];
  spfVerdict?: SESReceiptStatusValue | SESReceiptStatusValue[];
  dkimVerdict?: SESReceiptStatusValue | SESReceiptStatusValue[];
  dmarcVerdict?: SESReceiptStatusValue | SESReceiptStatusValue[];
  customFilter?: (input: SESFilterInput) => boolean | Promise<boolean>;
}

export interface SESRouteDefinition {
  filters: SESFilters;
  middleware?: SESMiddleware[];
  handler: SESRecordHandler;
}

export interface SESRouterOptions {
  middleware?: SESMiddleware[];
}
