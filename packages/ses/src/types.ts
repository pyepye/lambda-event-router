import type { Context, SESEventRecord, SESMail, SESReceipt } from 'aws-lambda';

import type { FilterStringMatcher, Middleware } from '@lambda-event-router/base';

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

export type SESDisposition = 'STOP_RULE' | 'STOP_RULE_SET' | 'CONTINUE';

// aws-lambda types SESHandler as Handler<SESEvent, void>, but the SES docs states it supports
// a disposition returned
// https://docs.aws.amazon.com/ses/latest/dg/receiving-email-action-lambda.html
export interface SESResult {
  disposition: SESDisposition;
}

// biome-ignore lint/suspicious/noConfusingVoidType: a handler may return nothing, meaning CONTINUE
export type SESResponse = SESDisposition | SESResult | void;

export type SESMiddleware = Middleware<SESRequest, SESResponse>;

export type SESRecordHandler = (request: SESRequest) => Promise<SESResponse>;

export interface SESFilterInput {
  receipt: SESReceipt;
  mail: SESMail;
}

export interface SESFilters {
  recipient?: FilterStringMatcher;
  sender?: FilterStringMatcher;
  spamVerdict?: SESReceiptStatusValue | SESReceiptStatusValue[];
  virusVerdict?: SESReceiptStatusValue | SESReceiptStatusValue[];
  spfVerdict?: SESReceiptStatusValue | SESReceiptStatusValue[];
  dkimVerdict?: SESReceiptStatusValue | SESReceiptStatusValue[];
  dmarcVerdict?: SESReceiptStatusValue | SESReceiptStatusValue[];
  custom?: (input: SESFilterInput) => boolean | Promise<boolean>;
}

export interface SESRouteDefinition {
  filters: SESFilters;
  middleware?: SESMiddleware[];
  handler: SESRecordHandler;
}

export interface SESRouterOptions {
  middleware?: SESMiddleware[];
}
