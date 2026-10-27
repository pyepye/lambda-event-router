import type { Handler } from 'aws-lambda';

import { Latcher } from '@latcher/base';

import { stepFunctionsMatcher } from './stepfunctions.js';

const latcher = new Latcher({ matchers: [stepFunctionsMatcher] });

export const handler: Handler = latcher.handler();
