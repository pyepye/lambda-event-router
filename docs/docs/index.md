# Overview

Lambda Event Router is a TypeScript framework for routing AWS Lambda events. You define [routers](/docs/routers) for the AWS services you care about, register them with a [`LambdaRouter`](/routers/LambdaRouter) and the framework works out which router should handle each event.

This is really help when you want a single Lambda, or a set of Lambdas with shared code, to handle events from multiple sources. Instead of writing your own event detection logic, you declare [filters](/docs/routing#filters) and [handlers](/docs/handlers) and let the router do the matching.

We cover every AWS service that can [natively invoke a Lambda](https://docs.aws.amazon.com/lambda/latest/dg/lambda-services.html). Check the [packages page](/packages) for the full list. For AWS services without a direct Lambda trigger, you can use the [`EventBridgeRouter`](/routers/EventBridgeRouter) with CloudTrail events to cover those too.


## Key concepts

**Standardised routing** - The same pattern works across all AWS services / events. You define routes with filters and handlers regardless of whether you're dealing with SQS, API Gateway or DynamoDB Streams. See [what every router has in common](/docs/routers#same-shape-everywhere).

**Type-safe simplified requests and responses** - Each router gives you typed request objects with the data you actually need. Return types are enforced too, so you can't accidentally return the wrong shape for a given event source. See [requests](/docs/handlers#requests) and [responses](/docs/handlers#responses).

**Declarative filtering** - Route events using service-specific data like ARN, message attributes, event name, HTTP method or detail type. You can also pass [custom filter functions](/docs/routing#custom) for anything more specific. See [filters](/docs/routing#filters) for the keys and [match order](/docs/routing#match-order) for how ties are settled.

**Schema validation** - Validate parts of the event - body, attributes, path params - using any [Standard Schema](https://github.com/standard-schema/standard-schema) compatible library like Zod, Valibot or ArkType. See [schema validation](/docs/routing#schema-validation).

**Middleware** - Run code around your handlers for timing, tracing or auth checks, attached to [every event, one router or one route](/docs/middleware#where-middleware-attaches).


## Why Lambda Event Router?

The framework handles event detection and routing so you can focus on your business logic. The API is consistent across every supported service, once you understand how the routing works for one event, you understand them all.

Everything is fully typed. Handler types are [inferred from the schemas on the route](/docs/handlers#inferred-handlers), validation feeds into them and each router enforces the correct response shape for its event source. You can [name those types yourself](/docs/handlers#annotated-handlers) instead if you would rather.


## Who is it for?

Lambda Event Router is a good fit when:

- You use lambdas as your main compute and use different AWS services as event triggers
- You want one Lambda handling multiple events from the same service. For example, a large number of APIGateway endpoints or several different SQS message types routed to different handlers.
- You deal with events from multiple different AWS services and want a consistent pattern rather than bespoke event handling for each one.
- You don't want hundreds of single-purpose Lambdas with sprawling deployments that are hard to manage


## When not to use it

If your Lambda handles a single event source in a single way, you probably don't need this. Here are some cases where it isn't the right fit:

- **Single event source with no filtering** - Your Lambda receives events from one source and processes them all the same way. A plain handler function is simpler.
- **Single-purpose Lambdas** - Your Lambda does exactly one thing. Routing and filtering add indirection with no upside.
- **HTTP-only Lambdas** - Dedicated HTTP frameworks like Express, Hono and Fastify have richer ecosystems for middleware, auth and templating.
- **Performance-critical Lambdas with simple logic** - The router iterates through registered routers via `canHandleEvent` checks and applies [middleware chains](/docs/middleware#execution-order). For ultra-simple Lambdas where every millisecond counts, a direct handler avoids this overhead.
- **One Lambda per event source** - If you intentionally map one Lambda to one event source for isolated scaling, permissions or deployment, there's nothing to route between.


## What next?

Head to the [quick start](/docs/quick-start) to get going.
