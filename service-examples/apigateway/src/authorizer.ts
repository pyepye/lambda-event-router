import type { Handler } from 'aws-lambda';

import { Latcher } from '@latcher/base';

import { authorizerMatcher } from './authorizerMatcher.js';

const latcher = new Latcher({ matchers: [authorizerMatcher] });

export const handler: Handler = latcher.handler();
