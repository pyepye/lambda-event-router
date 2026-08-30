import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

export const cloudWatch = new CloudWatchClient();
export const secretsManager = new SecretsManagerClient();

export const SECRET_ARN = process.env.SECRET_ARN ?? '';
export const FAILED_LOGIN_FILTER = process.env.FAILED_LOGIN_FILTER ?? '';
export const METRIC_NAMESPACE = process.env.METRIC_NAMESPACE ?? '';
export const METRIC_NAME = process.env.METRIC_NAME ?? '';
export const ROTATION_MAX_AGE_DAYS = Number(process.env.ROTATION_MAX_AGE_DAYS);
