import type { Handler } from 'aws-lambda';

import { Latcher } from '@latcher/base';

import { eventsMatcher } from './eventsMatcher.js';
import { resolverMatcher } from './resolverMatcher.js';

const latcher = new Latcher({ matchers: [resolverMatcher, eventsMatcher] });

export const handler: Handler = latcher.handler();
