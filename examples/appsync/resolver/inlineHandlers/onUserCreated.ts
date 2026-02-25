import { defineRoute } from '@lambda-event-router/appsync';

// Subscription resolver — controls authorization and filtering for the onUserCreated subscription.
// Return the event payload to allow the subscription, or null to filter it out.
export const onUserCreatedRoute = defineRoute({
  filters: {
    parentTypeNames: ['Subscription'],
    fieldNames: ['onUserCreated'],
  },
}).handle(async (request) => {
  const { arguments: args, identity } = request;

  // e.g. only allow subscribers to receive events for their own tenant
  const hasClaims = identity && 'claims' in identity;
  const subscriberTenantId = hasClaims ? identity.claims?.tenantId : undefined;
  const eventTenantId = args.tenantId;

  const isSameTenant = subscriberTenantId === eventTenantId;

  if (!isSameTenant) {
    // Returning null filters out the event — subscriber will not receive it
    return null;
  }

  console.log(`Subscription authorized for tenant ${subscriberTenantId}`);

  return {
    id: args.userId,
    name: args.name,
    tenantId: eventTenantId,
  };
});
