# Overview

## Introduction

- Can handle any event triggered from an AWS service
- 28(?) service specific routers with event specific details
  - Link to AWS docs for support events
- EventBridge + CloudTrail for any AWS services without defined lambda triggers
- Link to Packages page for support AWS services


## Key concepts

- Standardised routing event triggers and types
- Helpful filters and data validation based on event data
- Specific request and response based on expected event and return values
- Fully typed


## Who is Lambda Event Router for?

- Want same lambda to handle multiple event for the same service
  - E.g. API endpoints, different SQS messages
- Don't need 1000's of individual functions with sprawling deployments
- Deal with lots of different types of events within lambdas


## Why Lambda Event Router

- Simple routing - Easy tp deal with multiple events from the same AWS services
- Standard syntax - Easy to jump between different event from different AWS services
- Focus on business logic


## When not to use Lambda Event Router

- <Grab from README>
