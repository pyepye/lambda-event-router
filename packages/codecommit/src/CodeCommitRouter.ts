import type { EventTypeRouter } from '@lambda-event-router/base';
import { handleEventWithMiddleware, isObject } from '@lambda-event-router/base';
import type { Context } from 'aws-lambda';
import type {
  CodeCommitEvent,
  CodeCommitFilters,
  CodeCommitMiddleware,
  CodeCommitRecord,
  CodeCommitRecordHandler,
  CodeCommitReference,
  CodeCommitRequest,
  CodeCommitRouteDefinition,
  CodeCommitRouterOptions,
} from './types.js';

type ReferenceFilter = 'push' | 'branchCreated' | 'branchDeleted';

interface InternalRoute {
  filters: CodeCommitFilters;
  middleware: CodeCommitMiddleware[];
  handler: CodeCommitRecordHandler;
  referenceFilter?: ReferenceFilter;
}

interface MatchResult {
  route: InternalRoute;
  references: CodeCommitReference[];
}

interface RouteInput {
  filters: CodeCommitFilters;
  middleware?: CodeCommitMiddleware[];
}

interface RouteBuilder {
  handle(handler: CodeCommitRecordHandler): CodeCommitRouteDefinition;
}

export function defineRoute(config: RouteInput): RouteBuilder {
  return {
    handle(handler: CodeCommitRecordHandler): CodeCommitRouteDefinition {
      return { ...config, handler };
    },
  };
}

// Extract repository name from the last segment of the ARN
// e.g. "arn:aws:codecommit:eu-west-1:123456789012:my-repo" → "my-repo"
function extractRepositoryNameFromArn(arn: string): string {
  const lastColonIndex = arn.lastIndexOf(':');
  return arn.slice(lastColonIndex + 1);
}

function extractBranchNameFromRef(ref: string): string {
  return ref.replace('refs/heads/', '');
}

export class CodeCommitRouter implements EventTypeRouter<CodeCommitEvent, undefined> {
  private routes: InternalRoute[] = [];
  private middleware: CodeCommitMiddleware[];

  constructor(options?: CodeCommitRouterOptions) {
    this.middleware = options?.middleware ?? [];
  }

  canHandleEvent(event: unknown): event is CodeCommitEvent {
    if (!isObject(event)) return false;
    if (!Array.isArray(event.Records)) return false;

    const firstRecord = event.Records[0];
    /* v8 ignore next -- @preserve - Guard is for TS. AWS always sends at least one record */
    if (!isObject(firstRecord)) return false;

    return firstRecord.eventSource === 'aws:codecommit';
  }

  route(definition: CodeCommitRouteDefinition): this {
    this.routes.push({ ...definition, middleware: definition.middleware ?? [] });
    return this;
  }

  push(definition: CodeCommitRouteDefinition): this {
    this.routes.push({ ...definition, middleware: definition.middleware ?? [], referenceFilter: 'push' });
    return this;
  }

  branchCreated(definition: CodeCommitRouteDefinition): this {
    this.routes.push({ ...definition, middleware: definition.middleware ?? [], referenceFilter: 'branchCreated' });
    return this;
  }

  branchDeleted(definition: CodeCommitRouteDefinition): this {
    this.routes.push({ ...definition, middleware: definition.middleware ?? [], referenceFilter: 'branchDeleted' });
    return this;
  }

  async handleEvent(event: CodeCommitEvent, context: Context): Promise<undefined> {
    const recordPromises = event.Records.map((record) => this.processRecord(record, context));
    await Promise.all(recordPromises);
  }

  private filterReferences(references: CodeCommitReference[], filter: ReferenceFilter): CodeCommitReference[] {
    switch (filter) {
      case 'push':
        return references.filter((ref) => !(ref.created || ref.deleted));
      case 'branchCreated':
        return references.filter((ref) => ref.created === true);
      case 'branchDeleted':
        return references.filter((ref) => ref.deleted === true);
    }
  }

  // Test a single route against a record, returning the matched references if it passes all filters
  private matchRoute(route: InternalRoute, record: CodeCommitRecord): MatchResult | undefined {
    const { filters, referenceFilter } = route;

    // Apply reference filter if set
    let effectiveReferences = record.codecommit.references;
    if (referenceFilter) {
      effectiveReferences = this.filterReferences(record.codecommit.references, referenceFilter);
      if (effectiveReferences.length === 0) return undefined;
    }

    // eventSourceArns filter
    const { eventSourceArn } = filters;
    if (eventSourceArn) {
      const eventSourceArns = Array.isArray(eventSourceArn) ? eventSourceArn : [eventSourceArn];
      if (!eventSourceArns.includes(record.eventSourceARN)) {
        return undefined;
      }
    }

    const { repositoryName } = filters;
    if (repositoryName) {
      const repositoryNames = Array.isArray(repositoryName) ? repositoryName : [repositoryName];
      const sourceRepositoryName = extractRepositoryNameFromArn(record.eventSourceARN);
      if (!repositoryNames.includes(sourceRepositoryName)) return undefined;
    }

    const { branch } = filters;
    if (branch) {
      const branches = Array.isArray(branch) ? branch : [branch];
      const hasMatchingBranch = effectiveReferences.some((ref) => {
        const branchName = extractBranchNameFromRef(ref.ref);
        return branches.includes(branchName);
      });
      if (!hasMatchingBranch) return undefined;
    }

    const { branchPrefix } = filters;
    if (branchPrefix) {
      const branchPrefixes = Array.isArray(branchPrefix) ? branchPrefix : [branchPrefix];
      const hasMatchingPrefix = effectiveReferences.some((ref) => {
        const branchName = extractBranchNameFromRef(ref.ref);
        return branchPrefixes.some((prefix) => branchName.startsWith(prefix));
      });
      if (!hasMatchingPrefix) return undefined;
    }

    const { branchSuffix } = filters;
    if (branchSuffix) {
      const branchSuffixes = Array.isArray(branchSuffix) ? branchSuffix : [branchSuffix];
      const hasMatchingSuffix = effectiveReferences.some((ref) => {
        const branchName = extractBranchNameFromRef(ref.ref);
        return branchSuffixes.some((suffix) => branchName.endsWith(suffix));
      });
      if (!hasMatchingSuffix) return undefined;
    }

    const { branchIncludes: branchIncludesFilter } = filters;
    if (branchIncludesFilter) {
      const branchIncludes = Array.isArray(branchIncludesFilter) ? branchIncludesFilter : [branchIncludesFilter];
      const hasMatchingSubstring = effectiveReferences.some((ref) => {
        const branchName = extractBranchNameFromRef(ref.ref);
        return branchIncludes.some((substring) => branchName.includes(substring));
      });
      if (!hasMatchingSubstring) return undefined;
    }

    // customFilter
    const { customFilter } = filters;
    if (customFilter) {
      const filterInput = {
        references: effectiveReferences,
        userIdentityARN: record.userIdentityARN,
        eventSourceARN: record.eventSourceARN,
        eventTriggerName: record.eventTriggerName,
      };
      if (!customFilter(filterInput)) return undefined;
    }

    return { route, references: effectiveReferences };
  }

  // Unlike other routers which use first-match, CodeCommit matches ALL routes against a record.
  // A single record can contain references of different types (push, branch create, branch delete)
  // so multiple routes can legitimately match the same record with different reference subsets.
  // First-match would silently drop valid matches depending on route registration order.
  private matchRoutes(record: CodeCommitRecord): MatchResult[] {
    const matches: MatchResult[] = [];
    for (const route of this.routes) {
      const result = this.matchRoute(route, record);
      if (result) {
        matches.push(result);
      }
    }
    return matches;
  }

  private async processRecord(record: CodeCommitRecord, context: Context): Promise<void> {
    const matchResults = this.matchRoutes(record);
    if (matchResults.length === 0) {
      throw new Error(`No route matched for CodeCommit record ${record.eventId}`);
    }

    const handlerPromises = matchResults.map((matchResult) => {
      const { route, references } = matchResult;
      const request: CodeCommitRequest = {
        references,
        userIdentityARN: record.userIdentityARN,
        eventTriggerName: record.eventTriggerName,
        eventSourceARN: record.eventSourceARN,
        record,
        context,
      };

      const allMiddleware = [...this.middleware, ...route.middleware];
      return handleEventWithMiddleware(allMiddleware, request, route.handler);
    });
    await Promise.all(handlerPromises);
  }
}

export function createCodeCommitRouter(options?: CodeCommitRouterOptions): CodeCommitRouter {
  return new CodeCommitRouter(options);
}
