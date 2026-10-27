import type { Handler } from 'aws-lambda';

import { Latcher } from '@latcher/base';

import { apiMatcher } from './apiMatcher.js';
import { webSocketMatcher } from './webSocketMatcher.js';

const latcher = new Latcher({ matchers: [apiMatcher, webSocketMatcher] });

export const handler: Handler = latcher.handler();
