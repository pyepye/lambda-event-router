import type { Context, SESEvent, SESEventRecord, SESMail, SESReceipt } from 'aws-lambda';

import type { EventTypeRouter } from '@lambda-event-router/base';
import { handleEventWithMiddleware, isObject } from '@lambda-event-router/base';

import type {
  SESFilters,
  SESMiddleware,
  SESRecordHandler,
  SESRequest,
  SESRouteDefinition,
  SESRouterOptions,
} from './types.js';

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

function extractDomain(email: string): string {
  const [, domain = ''] = email.split('@');
  return domain;
}

export class SESRouter implements EventTypeRouter<SESEvent, undefined> {
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

  async handleEvent(event: SESEvent, context: Context): Promise<undefined> {
    const recordPromises = event.Records.map((record) => this.processRecord(record, context));
    await Promise.all(recordPromises);
  }

  private async matchRoute(record: SESEventRecord): Promise<SESRouteDefinition | undefined> {
    const { mail, receipt } = record.ses;

    for (const route of this.routes) {
      const { filters } = route;

      if (filters.recipient) {
        const recipients = Array.isArray(filters.recipient) ? filters.recipient : [filters.recipient];
        const hasMatchingRecipient = receipt.recipients.some((recipient) => recipients?.includes(recipient));
        if (!hasMatchingRecipient) continue;
      }

      if (filters.sender) {
        const senders = Array.isArray(filters.sender) ? filters.sender : [filters.sender];
        if (!senders.includes(mail.source)) {
          continue;
        }
      }

      if (filters.senderDomain) {
        const senderDomains = Array.isArray(filters.senderDomain) ? filters.senderDomain : [filters.senderDomain];
        const senderDomain = extractDomain(mail.source);
        if (!senderDomains.includes(senderDomain)) continue;
      }

      if (filters.recipientDomain) {
        const { recipientDomain: filterRecipientDomain } = filters;
        const recipientDomains = Array.isArray(filterRecipientDomain) ? filterRecipientDomain : [filterRecipientDomain];
        const hasMatchingDomain = receipt.recipients.some((recipient) => {
          const domain = extractDomain(recipient);
          return recipientDomains.includes(domain);
        });
        if (!hasMatchingDomain) continue;
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

  private async processRecord(record: SESEventRecord, context: Context): Promise<void> {
    const route = await this.matchRoute(record);
    if (!route) {
      throw new Error(`No route matched for SES record ${record.ses.mail.messageId}`);
    }

    const { mail, receipt } = record.ses;
    const request = this.buildRequest(record, mail, receipt, context);

    const allMiddleware = [...this.middleware, ...(route.middleware ?? [])];
    await handleEventWithMiddleware(allMiddleware, request, route.handler);
  }
}

export function createSESRouter(options?: SESRouterOptions): SESRouter {
  return new SESRouter(options);
}
