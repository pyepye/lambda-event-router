import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { codePipelineRouter } from './codepipeline.js';

const lambdaRouter = new LambdaRouter({ routers: [codePipelineRouter] });

export const handler: Handler = lambdaRouter.handler();
