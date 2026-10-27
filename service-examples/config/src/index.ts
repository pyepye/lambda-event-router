import type { Handler } from 'aws-lambda';

import { Latcher } from '@latcher/base';

import { configMatcher } from './configMatcher.js';
import { configScheduledMatcher } from './configScheduledMatcher.js';

// Both matchers take Config rule events. The invokingEvent's messageType decides which one claims it.
const latcher = new Latcher({ matchers: [configMatcher, configScheduledMatcher] });

export const handler: Handler = latcher.handler();
