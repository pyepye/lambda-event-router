import type { Handler } from 'aws-lambda';

import { Latcher } from '@latcher/base';

import { returnsMatcher } from './returnsMatcher.js';

const latcher = new Latcher({ matchers: [returnsMatcher] });

export const handler: Handler = latcher.handler();
