import type { Handler } from 'aws-lambda';

import { Latcher } from '@latcher/base';

import { connectMatcher } from './connect.js';

const latcher = new Latcher({ matchers: [connectMatcher] });

export const handler: Handler = latcher.handler();
