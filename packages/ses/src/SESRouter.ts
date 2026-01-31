import type { EventTypeRouter } from '@lambda-event-router/base';
import { isObject } from '@lambda-event-router/base';
import type { Context, SESEvent, SESEventRecord, SESMail, SESReceipt } from 'aws-lambda';
import type { SESFilters, SESRecordHandler, SESRequest, SESRouteDefinition } from './types.js';

interface RouteInput {
  filters: SESFilters;
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
  const parts = email.split('@');
  return parts[1] ?? '';
}

export class SESRouter implements EventTypeRouter<SESEvent, undefined> {
  private routes: SESRouteDefinition[] = [];

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

  private matchRoute(record: SESEventRecord): SESRouteDefinition | undefined {
    const { mail, receipt } = record.ses;

    return this.routes.find((route) => {
      const { filters } = route;

      if (filters.recipients) {
        const hasMatchingRecipient = receipt.recipients.some((recipient) => filters.recipients?.includes(recipient));
        if (!hasMatchingRecipient) return false;
      }

      if (filters.senders && !filters.senders.includes(mail.source)) {
        return false;
      }

      if (filters.senderDomains) {
        const senderDomain = extractDomain(mail.source);
        if (!filters.senderDomains.includes(senderDomain)) return false;
      }

      if (filters.recipientDomains) {
        const hasMatchingDomain = receipt.recipients.some((recipient) => {
          const domain = extractDomain(recipient);
          return filters.recipientDomains?.includes(domain);
        });
        if (!hasMatchingDomain) return false;
      }

      if (filters.spamVerdict && !filters.spamVerdict.includes(receipt.spamVerdict.status)) {
        return false;
      }

      if (filters.virusVerdict && !filters.virusVerdict.includes(receipt.virusVerdict.status)) {
        return false;
      }

      if (filters.spfVerdict && !filters.spfVerdict.includes(receipt.spfVerdict.status)) {
        return false;
      }

      if (filters.dkimVerdict && !filters.dkimVerdict.includes(receipt.dkimVerdict.status)) {
        return false;
      }

      if (filters.dmarcVerdict && !filters.dmarcVerdict.includes(receipt.dmarcVerdict.status)) {
        return false;
      }

      if (filters.customFilter) {
        return filters.customFilter({ receipt, mail });
      }

      return true;
    });
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
    const route = this.matchRoute(record);
    if (!route) {
      throw new Error(`No route matched for SES record ${record.ses.mail.messageId}`);
    }

    const { mail, receipt } = record.ses;
    const request = this.buildRequest(record, mail, receipt, context);
    await route.handler(request);
  }
}

export function createSESRouter(): SESRouter {
  return new SESRouter();
}
