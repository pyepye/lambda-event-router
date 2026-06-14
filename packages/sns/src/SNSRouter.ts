import type { Context, SNSEvent, SNSEventRecord } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { EventTypeRouter, FilterStringMatcher, Middleware } from '@lambda-event-router/base';
import {
  filterStringMatcher,
  handleEventWithMiddleware,
  isObject,
  safeJsonParse,
  validateSchema,
} from '@lambda-event-router/base';

import type {
  SNSFilters,
  SNSMessageAttributes,
  SNSMessageAttributeValue,
  SNSRawMessageAttributes,
  SNSRecordHandler,
  SNSRequest,
  SNSRouteDefinition,
  SNSRouterOptions,
} from './types.js';

interface InternalRoute {
  filters: SNSFilters;
  bodySchema?: StandardSchemaV1;
  messageAttributesSchema?: StandardSchemaV1<unknown, SNSMessageAttributes>;
  middleware: Middleware<SNSRequest, void>[];
  handler: SNSRecordHandler;
}

interface RouteInput<
  TBodySchema extends StandardSchemaV1 | undefined = undefined,
  TMessageAttributesSchema extends StandardSchemaV1 | undefined = undefined,
  TBody = TBodySchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TBodySchema> : unknown,
  TMessageAttributes extends SNSMessageAttributes = TMessageAttributesSchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TMessageAttributesSchema> & SNSMessageAttributes
    : SNSMessageAttributes,
> {
  filters: SNSFilters;
  bodySchema?: TBodySchema;
  messageAttributesSchema?: TMessageAttributesSchema;
  middleware?: Middleware<SNSRequest<TBody, TMessageAttributes>, void>[];
}

interface RouteBuilder<TBody, TMessageAttributes extends SNSMessageAttributes> {
  handle(handler: SNSRecordHandler<TBody, TMessageAttributes>): SNSRouteDefinition<TBody, TMessageAttributes>;
}

export function defineRoute<
  TBodySchema extends StandardSchemaV1 | undefined = undefined,
  TMessageAttributesSchema extends StandardSchemaV1 | undefined = undefined,
  TBody = TBodySchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TBodySchema> : unknown,
  TMessageAttributes extends SNSMessageAttributes = TMessageAttributesSchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TMessageAttributesSchema> & SNSMessageAttributes
    : SNSMessageAttributes,
>(config: RouteInput<TBodySchema, TMessageAttributesSchema>): RouteBuilder<TBody, TMessageAttributes> {
  return {
    // biome-ignore lint/nursery/useExplicitType: handler type is inferred from RouteBuilder return type
    handle(handler): SNSRouteDefinition<TBody, TMessageAttributes> {
      return { ...config, handler } as SNSRouteDefinition<TBody, TMessageAttributes>;
    },
  };
}

export class SNSRouter implements EventTypeRouter<SNSEvent, undefined> {
  private routes: InternalRoute[] = [];
  private middleware: Middleware<SNSRequest, void>[];

  constructor(options?: SNSRouterOptions) {
    this.middleware = options?.middleware ?? [];
  }

  canHandleEvent(event: unknown): event is SNSEvent {
    if (!isObject(event)) return false;
    if (!Array.isArray(event.Records)) return false;

    const firstRecord = event.Records[0];
    if (!isObject(firstRecord)) return false;

    return firstRecord.EventSource === 'aws:sns';
  }

  route<TBody, TMessageAttributes extends SNSMessageAttributes>(
    definition: SNSRouteDefinition<TBody, TMessageAttributes>,
  ): this {
    this.routes.push({
      filters: definition.filters,
      bodySchema: definition.bodySchema,
      messageAttributesSchema: definition.messageAttributesSchema,
      // @ts-expect-error Contravariance: typed middleware stored in general InternalRoute, safe because schema validates before calling
      middleware: definition.middleware ?? [],
      handler: definition.handler as SNSRecordHandler,
    });
    return this;
  }

  async handleEvent(event: SNSEvent, context: Context): Promise<undefined> {
    const recordPromises = event.Records.map((record) => this.processRecord(record, context));
    await Promise.all(recordPromises);
    return undefined;
  }

  // SNS sends Lambda nothing but String and Binary, whatever the attribute was published as. A Number
  // arrives as its digits and a String.Array as its JSON text.
  private convertMessageAttributes(raw: SNSRawMessageAttributes): SNSMessageAttributes {
    const result: SNSMessageAttributes = {};
    for (const [key, attr] of Object.entries(raw)) {
      result[key] = attr.Type === 'Binary' ? Buffer.from(attr.Value, 'base64') : attr.Value;
    }
    return result;
  }

  private async matchRoute(
    record: SNSEventRecord,
    body: unknown,
    messageAttributes: SNSMessageAttributes,
  ): Promise<InternalRoute | undefined> {
    for (const route of this.routes) {
      const { filters } = route;
      const sns = record.Sns;

      if (filters.topicArn) {
        const topicArnMatch = filterStringMatcher(sns.TopicArn, filters.topicArn);
        if (!topicArnMatch) continue;
      }

      if (filters.subject) {
        if (!sns.Subject) continue;
        const subjectMatch = filterStringMatcher(sns.Subject, filters.subject);
        if (!subjectMatch) continue;
      }

      if (filters.messageAttributes) {
        let matched = true;
        for (const [key, allowed] of Object.entries(filters.messageAttributes)) {
          const attr = messageAttributes[key];
          if (attr === undefined || !this.matchMessageAttribute(attr, allowed)) {
            matched = false;
            break;
          }
        }
        if (!matched) continue;
      }

      if (filters.custom) {
        const match = await filters.custom({ body, messageAttributes, record });
        if (!match) continue;
      }

      return route;
    }
    return undefined;
  }

  private async processRecord(record: SNSEventRecord, context: Context): Promise<void> {
    const parsedBody = safeJsonParse(record.Sns.Message);
    const convertedAttributes = this.convertMessageAttributes(record.Sns.MessageAttributes);

    const route = await this.matchRoute(record, parsedBody, convertedAttributes);
    if (!route) {
      throw new Error(`No route matched for record from ${record.Sns.TopicArn}`);
    }
    const bodyValidationError = `Body validation failed for record ${record.Sns.MessageId}`;
    const body = await validateSchema(parsedBody, route.bodySchema, bodyValidationError);

    const validatedMessageAttributes = await validateSchema(
      convertedAttributes,
      route.messageAttributesSchema,
      `Message attributes validation failed for record ${record.Sns.MessageId}`,
    );

    const request: SNSRequest = {
      body,
      messageAttributes: validatedMessageAttributes,
      record,
      context,
    };

    const allMiddleware = [...this.middleware, ...route.middleware];
    await handleEventWithMiddleware(allMiddleware, request, route.handler);
  }

  // A Binary attribute reaches here as a Buffer and matches nothing, because no matcher describes one.
  private matchMessageAttribute(attr: SNSMessageAttributeValue, allowed: FilterStringMatcher): boolean {
    return typeof attr === 'string' && filterStringMatcher(attr, allowed);
  }
}

export function createSNSRouter(options?: SNSRouterOptions): SNSRouter {
  return new SNSRouter(options);
}
