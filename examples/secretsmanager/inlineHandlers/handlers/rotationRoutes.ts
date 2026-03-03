import { defineRoute } from '@lambda-event-router/secretsmanager';

const DATABASE_SECRET_ARN = 'arn:aws:secretsmanager:eu-west-1:123456789012:secret:prod/database/password-AbCdEf';

// =============================================================================
// Routes using .route() style with steps filter
// =============================================================================

// Route for the createSecret step on a specific secret
export const createSecretRoute = defineRoute({
  filters: {
    secretIds: [DATABASE_SECRET_ARN],
    steps: ['createSecret'],
  },
}).handle(async ({ secretId, clientRequestToken }) => {
  console.log(`Creating new secret version for ${secretId} (token: ${clientRequestToken})`);
});

// Route for the setSecret step using prefix matching
export const setSecretRoute = defineRoute({
  filters: {
    secretPrefixes: ['prod/database/'],
    steps: ['setSecret'],
  },
}).handle(async ({ secretId, clientRequestToken }) => {
  console.log(`Setting secret for ${secretId} (token: ${clientRequestToken})`);
});

// Route for the testSecret step using suffix matching
export const testSecretRoute = defineRoute({
  filters: {
    secretSuffixes: ['/password', '-credentials'],
    steps: ['testSecret'],
  },
}).handle(async ({ secretId, clientRequestToken }) => {
  console.log(`Testing secret for ${secretId} (token: ${clientRequestToken})`);
});

// Route for the finishSecret step using includes matching
export const finishSecretRoute = defineRoute({
  filters: {
    secretIncludes: ['redis'],
    steps: ['finishSecret'],
  },
}).handle(async ({ secretId, clientRequestToken }) => {
  console.log(`Finishing rotation for ${secretId} (token: ${clientRequestToken})`);
});

// =============================================================================
// Routes using convenience methods (no steps filter needed)
// =============================================================================

// Convenience-method-compatible route — step is already implied by the method
export const databaseCreateRoute = defineRoute({
  filters: {
    secretIds: [DATABASE_SECRET_ARN],
  },
}).handle(async ({ secretId, clientRequestToken }) => {
  console.log(`[database] Creating secret version for ${secretId} (token: ${clientRequestToken})`);
});

export const databaseSetRoute = defineRoute({
  filters: {
    secretIds: [DATABASE_SECRET_ARN],
  },
}).handle(async ({ secretId, clientRequestToken }) => {
  console.log(`[database] Setting secret for ${secretId} (token: ${clientRequestToken})`);
});

export const databaseTestRoute = defineRoute({
  filters: {
    secretIds: [DATABASE_SECRET_ARN],
  },
}).handle(async ({ secretId, clientRequestToken }) => {
  console.log(`[database] Testing secret for ${secretId} (token: ${clientRequestToken})`);
});

export const databaseFinishRoute = defineRoute({
  filters: {
    secretIds: [DATABASE_SECRET_ARN],
  },
}).handle(async ({ secretId, clientRequestToken }) => {
  console.log(`[database] Finishing rotation for ${secretId} (token: ${clientRequestToken})`);
});

// Route matching rotations only during maintenance window hours (02:00–06:00 UTC)
const MAINTENANCE_WINDOW_START = 2;
const MAINTENANCE_WINDOW_END = 6;

export const maintenanceWindowRotationRoute = defineRoute({
  filters: {
    secretPrefixes: ['prod/'],
    steps: ['createSecret'],
    customFilter: () => {
      // Only allow rotation during the maintenance window — time-based logic that built-in filters can't express
      const currentHour = new Date().getUTCHours();
      return currentHour >= MAINTENANCE_WINDOW_START && currentHour < MAINTENANCE_WINDOW_END;
    },
  },
}).handle(async ({ secretId, clientRequestToken }) => {
  console.log(`Maintenance window rotation: ${secretId} (token: ${clientRequestToken})`);
});
