import type { Handler } from 'aws-lambda';

import { Latcher } from '@latcher/base';

import { rabbitMqMatcher } from './rabbitMq.js';

const latcher = new Latcher({ matchers: [rabbitMqMatcher] });

export const handler: Handler = latcher.handler();
