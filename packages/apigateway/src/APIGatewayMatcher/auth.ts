import type { APIGatewayEventClientCertificate } from 'aws-lambda';

import { isObject, type JsonValue } from '@latcher/base';

import type { LambdaAuthorizerContext } from '../LambdaAuthorizerMatcher/types.js';
import { type Claims, parseClaims } from './claims.js';

export interface APIGatewayApiKey {
  key: string;
  id: string | undefined;
}

export interface APIGatewayAuthExtras {
  apiKey?: APIGatewayApiKey;
  clientCert?: APIGatewayEventClientCertificate;
}

export interface LambdaAuth<TContext = LambdaAuthorizerContext> extends APIGatewayAuthExtras {
  type: 'lambda';
  principalId: string | undefined;
  context: TContext;
}

export interface CognitoAuth<TClaims = Claims> extends APIGatewayAuthExtras {
  type: 'cognito';
  claims: TClaims;
}

export interface JwtAuth<TClaims = Claims> extends APIGatewayAuthExtras {
  type: 'jwt';
  claims: TClaims;
  scopes: string[] | undefined;
}

export interface IamIdentity {
  accountId: string;
  userArn: string;
  callerId: string;
  userId: string;
  accessKey: string;
  principalOrgId: string | undefined;
  cognitoIdentityId: string | undefined;
  cognitoIdentityPoolId: string | undefined;
  cognitoAuthenticated: boolean | undefined;
  cognitoAmr: string[] | undefined;
}

export interface IamAuth extends APIGatewayAuthExtras {
  type: 'iam';
  iam: IamIdentity;
}

export interface ApiKeyAuth extends APIGatewayAuthExtras {
  type: 'apiKey';
  apiKey: APIGatewayApiKey;
}

export interface ClientCertAuth extends APIGatewayAuthExtras {
  type: 'clientCert';
  clientCert: APIGatewayEventClientCertificate;
}

export type APIGatewayAuth = LambdaAuth | CognitoAuth | JwtAuth | IamAuth | ApiKeyAuth | ClientCertAuth | undefined;

export type APIGatewayAuthorizer = LambdaAuth | CognitoAuth | JwtAuth | IamAuth;

const AUTHENTICATED = 'authenticated';
const UNAUTHENTICATED = 'unauthenticated';

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isClientCert(value: unknown): value is APIGatewayEventClientCertificate {
  return isObject(value) && typeof value.clientCertPem === 'string' && typeof value.subjectDN === 'string';
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isObject(value) && Object.values(value).every(isJsonValue);
}

export function readLambdaContext(values: Record<string, unknown>): LambdaAuthorizerContext {
  const context: LambdaAuthorizerContext = {};
  for (const [key, value] of Object.entries(values)) {
    if (isJsonValue(value)) context[key] = value;
  }
  return context;
}

export function readApiKey(identity: unknown): APIGatewayApiKey | undefined {
  if (!isObject(identity) || typeof identity.apiKey !== 'string') return undefined;
  return { key: identity.apiKey, id: stringOrUndefined(identity.apiKeyId) };
}

export function readClientCert(container: unknown): APIGatewayEventClientCertificate | undefined {
  if (!(isObject(container) && isClientCert(container.clientCert))) return undefined;
  return container.clientCert;
}

export function readClaims(value: unknown): Claims | undefined {
  return isObject(value) ? parseClaims(value) : undefined;
}

export function readScopes(value: unknown): string[] | undefined {
  return isStringArray(value) ? value : undefined;
}

function authenticatedFromAmr(amr: string[] | undefined): boolean | undefined {
  const [authenticationType] = amr ?? [];
  if (authenticationType === AUTHENTICATED) return true;
  if (authenticationType === UNAUTHENTICATED) return false;
  return undefined;
}

// REST sends the providers joined by commas, where HTTP API sends them as the rest of the amr list
function amrFromRestIdentity(authenticationType: unknown, providers: unknown): string[] | undefined {
  if (authenticationType !== AUTHENTICATED && authenticationType !== UNAUTHENTICATED) return undefined;
  const providerList = typeof providers === 'string' ? providers.split(',') : [];
  return [authenticationType, ...providerList];
}

export function readV1Iam(identity: unknown): IamIdentity | undefined {
  if (!isObject(identity)) return undefined;
  const { accountId, userArn, caller, user, accessKey } = identity;
  const isIamCaller =
    typeof accountId === 'string' &&
    typeof userArn === 'string' &&
    typeof caller === 'string' &&
    typeof user === 'string' &&
    typeof accessKey === 'string';
  if (!isIamCaller) return undefined;

  const cognitoAmr = isStringArray(identity.cognitoAmr)
    ? identity.cognitoAmr
    : amrFromRestIdentity(identity.cognitoAuthenticationType, identity.cognitoAuthenticationProvider);

  return {
    accountId,
    userArn,
    callerId: caller,
    userId: user,
    accessKey,
    principalOrgId: stringOrUndefined(identity.principalOrgId),
    cognitoIdentityId: stringOrUndefined(identity.cognitoIdentityId),
    cognitoIdentityPoolId: stringOrUndefined(identity.cognitoIdentityPoolId),
    cognitoAuthenticated: authenticatedFromAmr(cognitoAmr),
    cognitoAmr,
  };
}

export function readV2Iam(iam: unknown): IamIdentity | undefined {
  if (!isObject(iam)) return undefined;
  const { accountId, userArn, callerId, userId, accessKey } = iam;
  const isIamCaller =
    typeof accountId === 'string' &&
    typeof userArn === 'string' &&
    typeof callerId === 'string' &&
    typeof userId === 'string' &&
    typeof accessKey === 'string';
  if (!isIamCaller) return undefined;

  const cognitoIdentity = isObject(iam.cognitoIdentity) ? iam.cognitoIdentity : undefined;
  const cognitoAmr = isStringArray(cognitoIdentity?.amr) ? cognitoIdentity.amr : undefined;

  return {
    accountId,
    userArn,
    callerId,
    userId,
    accessKey,
    principalOrgId: stringOrUndefined(iam.principalOrgId),
    cognitoIdentityId: stringOrUndefined(cognitoIdentity?.identityId),
    cognitoIdentityPoolId: stringOrUndefined(cognitoIdentity?.identityPoolId),
    cognitoAuthenticated: authenticatedFromAmr(cognitoAmr),
    cognitoAmr,
  };
}

export function withExtras(authorizer: APIGatewayAuthorizer | undefined, extras: APIGatewayAuthExtras): APIGatewayAuth {
  const { apiKey, clientCert } = extras;
  const presentExtras: APIGatewayAuthExtras = {
    ...(apiKey && { apiKey }),
    ...(clientCert && { clientCert }),
  };

  if (authorizer) return { ...authorizer, ...presentExtras };
  if (apiKey) return { type: 'apiKey', ...presentExtras, apiKey };
  if (clientCert) return { type: 'clientCert', ...presentExtras, clientCert };
  return undefined;
}
