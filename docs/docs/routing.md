# Routing

## Handlers

- Who point of this framework is to get events to the code you want to run. These functions are call handlers
- Move info on handlers page


## Defining routes

- router.route() to register routes
- Some routers have custom routes for event specific base filtering
  - E.g. dynamodbRouter.insert(), apiGatewayRouter.post()
  - Same as defining a filter (see #filtering)
- 2 ways inline using defineRoute vs separate using a route object
  - Note: defineRoute maybe define<Router>Route for packages with multiple routers
- Inline good for automatic typing
- Separate good for route vs handler separation

### Inline

- Example with file structure

### Separate

- Example with file structure


## Filtering

- Each route object has a `filter` property
- Exposes different properties based on the event source / trigger
- Note that this is not the same for the HTTP handlers
- Some routers support specifc router defintions which used filters under the hood

### customFilter

- All routers have customFilter which is a function
- Has access to the event


## Schema validation

- Some routers have schema validation for different parts of the event
- Failing validation will do different things depending on the router
