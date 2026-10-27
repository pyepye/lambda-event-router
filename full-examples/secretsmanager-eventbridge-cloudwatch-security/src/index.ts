import type { Handler } from 'aws-lambda';

import { Latcher } from '@latcher/base';

import { cloudWatchLogsMatcher } from './cloudwatch.js';
import { eventBridgeMatcher } from './eventbridge.js';
import { secretsManagerMatcher } from './secretsmanager.js';

const latcher = new Latcher({ matchers: [eventBridgeMatcher, cloudWatchLogsMatcher, secretsManagerMatcher] });

export const handler: Handler = latcher.handler();
