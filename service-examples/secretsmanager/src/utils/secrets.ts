// The stack creates exactly these secrets, and the rotate and purge scripts take no arguments
// because they read the names from here.
export const SECRET_NAME_PREFIX = 'ler-example-secretsmanager';

export const SECRET_NAMES = {
  paymentsApiToken: `${SECRET_NAME_PREFIX}/payments/api-token`,
  webhookSigningKey: `${SECRET_NAME_PREFIX}/webhooks/signing-key`,
  searchIndexKey: `${SECRET_NAME_PREFIX}/search/index-key`,
  legacyFtpPassword: `${SECRET_NAME_PREFIX}/legacy/ftp-password`,
  retiredReportToken: `${SECRET_NAME_PREFIX}/retired/report-token`,
} as const;

// A secret carrying this tag set to 'true' has its rotation held.
export const ROTATION_PAUSED_TAG = 'RotationPaused';

export const TOKEN_LENGTH = 40;
