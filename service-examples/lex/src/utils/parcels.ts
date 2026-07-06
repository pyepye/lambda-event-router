import { ACCOUNT_TIER_ATTRIBUTE } from './constants.js';

const PARCEL_LOCATIONS: Record<string, string> = {
  AB123456: 'out for delivery in Leeds',
  CD987654: 'held at the Sheffield depot',
};

export function locateParcel(trackingNumber: string): string {
  return PARCEL_LOCATIONS[trackingNumber] ?? 'not on the network yet';
}

// The custom filter awaits this, so an async filter is what gets exercised.
export async function readAccountTier(sessionAttributes: Record<string, string>): Promise<string> {
  return sessionAttributes[ACCOUNT_TIER_ATTRIBUTE] ?? 'standard';
}
