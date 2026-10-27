import type { Handler } from 'aws-lambda';

import { Latcher } from '@latcher/base';

import { cognitoMatcher } from './cognito.js';
import { eventBridgeMatcher } from './eventbridge.js';
import { s3Matcher } from './s3.js';

const latcher = new Latcher({ matchers: [cognitoMatcher, eventBridgeMatcher, s3Matcher] });

export const handler: Handler = latcher.handler();
