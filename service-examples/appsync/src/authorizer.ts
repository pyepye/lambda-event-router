import type { Handler } from 'aws-lambda';

import { Latcher } from '@latcher/base';

import { authorizerMatcher } from './authorizerMatcher.js';
import { eventsAuthorizerMatcher } from './eventsAuthorizerMatcher.js';

// One function authorises both APIs. The two matchers take different event shapes, so `Latcher`
// picks between them without a filter.
const latcher = new Latcher({ matchers: [authorizerMatcher, eventsAuthorizerMatcher] });

export const handler: Handler = latcher.handler();
