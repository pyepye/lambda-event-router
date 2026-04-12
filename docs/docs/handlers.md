# Handlers

- Everything is fully typed
- Automatic typing for inline handlers (defineRoute), need to specify own types using generics for separate handlers


## Request

- Each handler gets a request arg which has different data in it depending on the router / event type
- Handlers for events which have records will be triggered per record
- Most request objects have the event and context as a fallback
- Record based events will also have the record


## Responses

- The response required depends on the trigger for the lambda
- Each Router will handle tell you what is needed via types


### Throwing Responses

- Lambdas which support error responses support throwing these responses
- Show examples in tabs - ApiGatewayRouter, CodePipeline and others which do different things


## Types

- Typing is done differently based on if inline or separate


### Inline

- Example


### Separate

- Example
