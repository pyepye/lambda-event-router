import type { Handler } from 'aws-lambda';

import { Latcher } from '@latcher/base';

import { snsMatcher } from './sns.js';

const latcher = new Latcher({ matchers: [snsMatcher] });

export const handler: Handler = latcher.handler();
