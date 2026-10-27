import type { Handler } from 'aws-lambda';

import { Latcher } from '@latcher/base';

import { codePipelineMatcher } from './codepipeline.js';

const latcher = new Latcher({ matchers: [codePipelineMatcher] });

export const handler: Handler = latcher.handler();
