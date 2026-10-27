import type { Handler } from 'aws-lambda';

import { Latcher } from '@latcher/base';

import { apiMatcher } from './api.js';
import { authorizerMatcher } from './authorizer.js';
import { dynamoDBMatcher } from './dynamodb.js';
import { sqsMatcher } from './sqs.js';

const latcher = new Latcher({ matchers: [apiMatcher, authorizerMatcher, dynamoDBMatcher, sqsMatcher] });

export const handler: Handler = latcher.handler();
