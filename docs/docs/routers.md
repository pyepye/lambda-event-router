# Routers


## Standard concepts

- Common and similar patterns
- Type safe request and responses. Correct return types etc
- Define routes which filter events to handlers
- Decodes base64. parses JSON strings, lowercase headers etc
- Can validates data
- Validates schemas on parts of the event when provided
- See quick start for basic set up


## Requests

- Each Router only allows valid


## Responses

- Each Router only allows valid responses for that event
- Nothing if router expects no response
- Collate record responses for each record if required
- Deal with batchItemFailures etc if required
- Some convert respones (e.g. APIGateway will convert to response with body and status code)
- Cognito will return original request with modifications
- CodePipeline will automatically make client call back


## LambdaRouter

- Register routers to it
- Routes events to specific routers - Routes events to routers based on the event envelope
- Works out which route should handle event based on properties and values in it
- Global middleware for all events - see middleware page


## EventRouter

- Only to be used for events with totally custom envelope
- customFilter for routing
- schema validation for type and data safety
- Included in base package


## EventBridgeRouter

- Standard but powerful router
- Can deal with all EventBridge except for Scheduler as it has custom envelope, use EventRouter
- E.g. EventBridge bus and Event Bridge pipe
- Can be used to support any "none native" AWS lambda service with CloudTrail
- See examples
