import type { Handler } from 'aws-lambda';

import { Latcher } from '@latcher/base';

import { dynamoDBMatcher } from './dynamodb.js';

const latcher = new Latcher({ matchers: [dynamoDBMatcher] });

export const handler: Handler = latcher.handler();
