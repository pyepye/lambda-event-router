import type { Handler } from 'aws-lambda';

import { Latcher } from '@latcher/base';

import { kafkaMatcher } from './kafka.js';

const latcher = new Latcher({ matchers: [kafkaMatcher] });

export const handler: Handler = latcher.handler();
