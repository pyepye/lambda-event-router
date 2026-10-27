import type { Handler } from 'aws-lambda';

import { Latcher } from '@latcher/base';

import { lexMatcher } from './lex.js';

const latcher = new Latcher({ matchers: [lexMatcher] });

export const handler: Handler = latcher.handler();
