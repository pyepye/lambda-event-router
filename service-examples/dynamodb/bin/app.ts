import { App } from 'aws-cdk-lib';

import { AppStack } from '../lib/app-stack.js';

const app = new App();

const stackName = app.node.tryGetContext('stackName') ?? 'ler-example-dynamodb';

new AppStack(app, stackName, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
