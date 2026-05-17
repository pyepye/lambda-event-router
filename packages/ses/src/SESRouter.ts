import type { Context, SESEvent, SESEventRecord, SESMail, SESReceipt } from 'aws-lambda';

import type { EventTypeRouter } from '@lambda-event-router/base';
import { filterStringMatcher, handleEventWithMiddleware, isObject } from '@lambda-event-router/base';

import type {
  SESDisposition,
  SESFilters,
  SESMiddleware,
  SESRecordHandler,
  SESRequest,
  SESResponse,
  SESResult,
  SESRouteDefinition,
  SESRouterOptions,
} from './types.js';

// SES reads a single disposition per invocation, so when several records resolve their own, the
// strongest wins: STOP_RULE_SET halts the rule set, STOP_RULE halts the current rule, CONTINUE lets
// mail flow on. See https://docs.aws.amazon.com/ses/latest/dg/receiving-email-action-lambda.html
const dispositionRank: Record<SESDisposition, number> = {
  CONTINUE: 0,
  STOP_RULE: 1,
  STOP_RULE_SET: 2,
};

interface RouteInput {
  filters: SESFilters;
  middleware?: SESMiddleware[];
}

interface RouteBuilder {
  handle(handler: SESRecordHandler): SESRouteDefinition;
}

export function defineRoute(config: RouteInput): RouteBuilder {
  return {
    handle(handler: SESRecordHandler): SESRouteDefinition {
      return { ...config, handler };
    },
  };
}

export class SESRouter implements EventTypeRouter<SESEvent, SESResult> {
  private routes: SESRouteDefinition[] = [];
  private middleware: SESMiddleware[];

  constructor(options?: SESRouterOptions) {
    this.middleware = options?.middleware ?? [];
  }

  canHandleEvent(event: unknown): event is SESEvent {
    if (!isObject(event)) return false;
    if (!Array.isArray(event.Records)) return false;

    const firstRecord = event.Records[0];
    if (!isObject(firstRecord)) return false;

    return firstRecord.eventSource === 'aws:ses';
  }

  route(definition: SESRouteDefinition): this {
    this.routes.push(definition);
    return this;
  }

  async handleEvent(event: SESEvent, context: Context): Promise<SESResult> {
    const recordPromises = event.Records.map((record) => this.processRecord(record, context));
    const responses = await Promise.all(recordPromises);

    return { disposition: this.strongestDisposition(responses) };
  }

  private strongestDisposition(responses: SESResponse[]): SESDisposition {
    return responses.reduce<SESDisposition>((strongest, response) => {
      const candidate = this.toDisposition(response);
      return dispositionRank[candidate] > dispositionRank[strongest] ? candidate : strongest;
    }, 'CONTINUE');
  }

  private toDisposition(response: SESResponse): SESDisposition {
    if (!response) return 'CONTINUE';
    return typeof response === 'string' ? response : response.disposition;
  }

  private async matchRoute(record: SESEventRecord): Promise<SESRouteDefinition | undefined> {
    const { mail, receipt } = record.ses;

    for (const route of this.routes) {
      const { filters } = route;

      if (filters.recipient) {
        const { recipient: recipientFilter } = filters; // Needed here due to TS having different scope for  separate function closure
        const recipientMatch = receipt.recipients.some((recipient) => filterStringMatcher(recipient, recipientFilter));
        if (!recipientMatch) continue;
      }

      if (filters.sender) {
        const senderMatch = filterStringMatcher(mail.source, filters.sender);
        if (!senderMatch) continue;
      }

      if (filters.spamVerdict) {
        const spamVerdicts = Array.isArray(filters.spamVerdict) ? filters.spamVerdict : [filters.spamVerdict];
        if (!spamVerdicts.includes(receipt.spamVerdict.status)) {
          continue;
        }
      }

      if (filters.virusVerdict) {
        const virusVerdicts = Array.isArray(filters.virusVerdict) ? filters.virusVerdict : [filters.virusVerdict];
        if (!virusVerdicts.includes(receipt.virusVerdict.status)) {
          continue;
        }
      }

      if (filters.spfVerdict) {
        const spfVerdicts = Array.isArray(filters.spfVerdict) ? filters.spfVerdict : [filters.spfVerdict];
        if (!spfVerdicts.includes(receipt.spfVerdict.status)) {
          continue;
        }
      }

      if (filters.dkimVerdict) {
        const dkimVerdicts = Array.isArray(filters.dkimVerdict) ? filters.dkimVerdict : [filters.dkimVerdict];
        if (!dkimVerdicts.includes(receipt.dkimVerdict.status)) {
          continue;
        }
      }

      if (filters.dmarcVerdict) {
        const dmarcVerdicts = Array.isArray(filters.dmarcVerdict) ? filters.dmarcVerdict : [filters.dmarcVerdict];
        if (!dmarcVerdicts.includes(receipt.dmarcVerdict.status)) {
          continue;
        }
      }

      if (filters.customFilter) {
        const match = await filters.customFilter({ receipt, mail });
        if (!match) continue;
      }

      return route;
    }

    return undefined;
  }

  private buildRequest(record: SESEventRecord, mail: SESMail, receipt: SESReceipt, context: Context): SESRequest {
    return {
      source: mail.source,
      subject: mail.commonHeaders.subject,
      recipients: receipt.recipients,
      receipt,
      mail,
      record,
      context,
    };
  }

  private async processRecord(record: SESEventRecord, context: Context): Promise<SESResponse> {
    const route = await this.matchRoute(record);
    if (!route) {
      throw new Error(`No route matched for SES record ${record.ses.mail.messageId}`);
    }

    const { mail, receipt } = record.ses;
    const request = this.buildRequest(record, mail, receipt, context);

    const allMiddleware = [...this.middleware, ...(route.middleware ?? [])];
    return handleEventWithMiddleware(allMiddleware, request, route.handler);
  }
}

export function createSESRouter(options?: SESRouterOptions): SESRouter {
  return new SESRouter(options);
}
