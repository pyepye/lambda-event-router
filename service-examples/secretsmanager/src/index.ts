import type { Handler } from 'aws-lambda';

import { Latcher } from '@latcher/base';

import { secretsManagerMatcher } from './secretsManager.js';

const latcher = new Latcher({ matchers: [secretsManagerMatcher] });

export const handler: Handler = latcher.handler();
