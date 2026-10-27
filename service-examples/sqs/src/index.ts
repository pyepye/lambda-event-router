import type { Handler } from 'aws-lambda';

import { Latcher } from '@latcher/base';

import { sqsMatcher } from './sqs.js';

const latcher = new Latcher({ matchers: [sqsMatcher] });

export const handler: Handler = latcher.handler();
