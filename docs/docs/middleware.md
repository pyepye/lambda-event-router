# Middleware

<!-- TODO: Find docs for other frameworks which do middleware in the same way for inspiration -->

## Execution Order

- Make diagram that will show.
  - Circle response request? e.g. https://docs.aiogram.dev/en/v3.14.0/dispatcher/middlewares.html
  - Powertools flow diagram? OR https://www.simplybusiness.co.uk/about-us/tech/2019/07/rack-middleware-pattern-description/
  - Arrows down? https://contributte.org/packages/contributte/middlewares.html
  - Pre / post processing? https://k0s.org/mozilla/craft/middleware.html


## LambdaRouter Middleware (Global)

- Runs for all requests
- On base event
- Before lambda exit
- Used for profiling, tracing etc

- [Give example]

## Router Middleware

- Initialted on each router but runs just before each handler
- Route has already been matched
- Does not trigger if route is not matched
- If record based event, meant for each record, if shortcut will skip each record

- [Give example]


## Route Middleware

- Only for individual route
- Runs just after router middlware
- If record based middleware runs just

- [Give example]


## Full example

- Give example with code structure and each type of middleware used
