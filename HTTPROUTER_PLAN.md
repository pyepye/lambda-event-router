 Adapter Pattern for HTTPRouter

 Context

 The @lambda-event-router/http package currently has API Gateway V2 payload 2.0 types hardcoded throughout — in HTTPRouter, Request, Response, and types.ts. Step 12 of
 HTTP_SERVICES_PLAN.md calls for moving API Gateway-specific code out of http into apigateway, leaving the base service-agnostic.

 Instead of abstract methods, we'll use an adapter pattern: a single HTTPAdapter<TEvent, TResult> interface that each service implements. The adapter normalizes the raw
 event into a common shape and converts the finalized response back to the service-specific format.

 This change enables APIGatewayRouter to handle V1 REST API, V2 payload 1.0, and V2 payload 2.0 — all auto-detected in a single router.

 Design

 HTTPAdapter<TEvent, TResult> interface (in http package)
   ├── canHandleEvent(event: unknown): event is TEvent
   ├── normalize(event: TEvent): NormalizedHTTPEvent
   └── buildResult(response: FinalizedHTTPResponse, event: TEvent): TResult

 HTTPRouter<TEvent, TResult> (concrete, takes adapter via constructor)
   └── Request consumes NormalizedHTTPEvent (no AWS imports)

 apigateway package provides:
   ├── apiGatewayV2Adapter  (V2 payload 2.0)
   ├── apiGatewayV1Adapter  (V1 REST API / V2 payload 1.0 — same types)
   └── apiGatewayAdapter    (combined, auto-detects via V2-first check)

 Key types:
 - NormalizedHTTPEvent — { method, path, headers, query, body, isBase64Encoded, auth }
 - Auth — { claims?, scopes?, principalId?, context?, clientCert?, iam? } — normalized across all authorizer types
 - FinalizedHTTPResponse — { statusCode, body: string, headers? } — body already stringified, pre-adapter conversion

 ApiRequest gains a TEvent generic for typed raw event access: ApiRequest<TPath, TQuery, TBody, TEvent>

 Steps

 Step 1: Add new types to packages/http/src/types.ts

 - Add Auth, NormalizedHTTPEvent, FinalizedHTTPResponse, HTTPAdapter<TEvent, TResult>
 - Add TEvent = unknown generic to ApiRequest — change event field to TEvent, headers to Record<string, string | undefined>
 - Remove APIGatewayV2EventType and all aws-lambda imports (keep Context from aws-lambda)

 Step 2: Make Response service-agnostic — packages/http/src/Response.ts

 - Instance methods (create, notFound, internalServerError, etc.) return FinalizedHTTPResponse instead of Promise<APIGatewayProxyResultV2>
 - Drop async from these methods (nothing async about serialization)
 - Remove aws-lambda import
 - Static methods unchanged (already return generic HTTPResponse)

 Step 3: Refactor Request — packages/http/src/Request.ts

 - Constructor takes NormalizedHTTPEvent + rawEvent: unknown + context + route + pathParams
 - Properties (headers, method, path) read from NormalizedHTTPEvent
 - parseBody() uses normalizedEvent.body / normalizedEvent.isBase64Encoded
 - auth getter returns normalizedEvent.auth directly — remove parseAuth() entirely
 - queryParams returns normalizedEvent.query
 - buildApiRequest() sets event: this.rawEvent
 - Remove all aws-lambda imports, remove isJWTAuthorizer/isIAMAuthorizer type guards (move to apigateway)

 Step 4: Refactor HTTPRouter — packages/http/src/HTTPRouter.ts

 - Change from abstract class to class HTTPRouter<TEvent, TResult>
 - Constructor accepts HTTPAdapter<TEvent, TResult>
 - canHandleEvent delegates to adapter.canHandleEvent()
 - handleEvent:
   - Calls adapter.normalize(event) to get NormalizedHTTPEvent
   - Creates Request with normalized event
   - Calls adapter.buildResult(finalizedResponse, event) to convert the response
 - Remove aws-lambda imports
 - Route registration methods (get/post/put/patch/delete/route) unchanged

 Step 5: Update packages/http/src/index.ts exports

 - Export HTTPAdapter, NormalizedHTTPEvent, Auth, FinalizedHTTPResponse
 - Remove APIGatewayV2EventType export (if it was exported)

 Step 6: Create V2 adapter — packages/apigateway/src/apiGatewayV2Adapter.ts

 - Move APIGatewayV2EventType union here
 - Move isJWTAuthorizer / isIAMAuthorizer type guards here
 - Move canHandleEvent logic here (checks rawPath, requestContext.http.method)
 - normalize() — extracts method/path/headers/query/body/auth from V2 event
 - extractV2Auth() — moved from Request.parseAuth(), normalizes JWT claims, IAM, Lambda authorizer, mTLS into Auth
 - buildResult() — returns { statusCode, body, headers } as APIGatewayProxyResultV2

 Step 7: Create V1 adapter — packages/apigateway/src/apiGatewayV1Adapter.ts

 - canHandleEvent checks httpMethod, path, requestContext (no rawPath)
 - normalize() — extracts from V1 event shape (httpMethod, path, flattened headers)
 - flattenHeaders() — merges multiValueHeaders into flat record
 - extractV1Auth() — handles Cognito (claims), Lambda authorizer (principalId + context), IAM (identity)
 - buildResult() — returns { statusCode, body, headers } as APIGatewayProxyResult

 Step 8: Create combined adapter — packages/apigateway/src/apiGatewayAdapter.ts

 - canHandleEvent — tries V2 first (more specific), falls back to V1
 - normalize — delegates to V2 or V1 adapter based on 'rawPath' in event
 - buildResult(response, event) — delegates based on event shape
 - Types: TEvent = APIGatewayProxyEvent | APIGatewayV2EventType, TResult = APIGatewayProxyResult | APIGatewayProxyResultV2

 Step 9: Update APIGatewayRouter — packages/apigateway/src/APIGatewayRouter.ts

 export class APIGatewayRouter extends HTTPRouter<APIGatewayEvent, APIGatewayResult> {
     constructor() {
       super(apiGatewayAdapter);
   }
 }

 User-facing createAPIGatewayRouter() API unchanged.

 Step 10: Update packages/apigateway/src/index.ts

 - Export adapters (apiGatewayAdapter, apiGatewayV1Adapter, apiGatewayV2Adapter)
 - Export APIGatewayV2EventType (moved from http)
 - Existing re-exports from http unchanged

 Step 11: Update tests

 - http tests: Create a mock adapter for HTTPRouter tests (no AWS imports in http tests). Update Request tests to use NormalizedHTTPEvent. Update Response tests for
 FinalizedHTTPResponse return type.
 - Move HTTPRouter.ApiGatewayV2.test.ts to apigateway package (it tests V2-specific behavior)
 - apigateway tests: Add adapter-specific tests (V1 detection, V2 detection, combined auto-detect, V1 auth extraction, header flattening)
 - Testing fixtures: Add V1 event factory (createApiGatewayV1Event) in packages/testing/src/apiGatewayV1.ts

 Step 12: Update examples

 - Existing examples should compile unchanged (createAPIGatewayRouter() API is the same)
 - Verify request.event type is acceptable (now union of V1|V2 for combined router)

 Files changed

 ┌────────────────────────────────────────────────┬─────────────────────────────────────────────────────────────────────────────┐
 │     File                                       │ Action                                                                      │
 ├────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
 │ packages/http/src/types.ts                     │ Add adapter/normalized types, genericize ApiRequest, remove AWS V2 types    │
 ├────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
 │ packages/http/src/Response.ts                  │ Return FinalizedHTTPResponse, drop async, remove aws-lambda import          │
 ├────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
 │ packages/http/src/Request.ts                   │ Consume NormalizedHTTPEvent, remove auth parsing, remove aws-lambda imports │
 ├────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
 │ packages/http/src/HTTPRouter.ts                │ Concrete generic class with adapter constructor, remove aws-lambda imports  │
 ├────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
 │ packages/http/src/index.ts                     │ Export new types                                                            │
 ├────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
 │ packages/apigateway/src/apiGatewayV2Adapter.ts │ New — V2 adapter with auth extraction                                       │
 ├────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
 │ packages/apigateway/src/apiGatewayV1Adapter.ts │ New — V1 adapter with header flattening, auth extraction                    │
 ├────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
 │ packages/apigateway/src/apiGatewayAdapter.ts   │ New — Combined auto-detecting adapter                                       │
 ├────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
 │ packages/apigateway/src/APIGatewayRouter.ts    │ Pass combined adapter to super                                              │
 ├────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
 │ packages/apigateway/src/index.ts               │ Export adapters and moved types                                             │
 ├────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
 │ packages/testing/src/apiGatewayV1.ts           │ New — V1 event factory                                                      │
 ├────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
 │ Various test files            │ Update for new types/patterns                                                                │
 └────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────────────────────┘

 Verification

 After each step, run:
 pnpm -F @lambda-event-router/http build && pnpm -F @lambda-event-router/http lint
 pnpm -F @lambda-event-router/apigateway build && pnpm -F @lambda-event-router/apigateway lint

 After tests are updated:
 pnpm -F @lambda-event-router/http test
 pnpm -F @lambda-event-router/apigateway test

 Final check — examples must compile:
 pnpm -F @lambda-event-router/examples build
