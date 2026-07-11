import { CodePipelineClient } from '@aws-sdk/client-codepipeline';

// An absent name would leave a functionName filter as an empty string, which the router reads as no
// filter at all. Every route would then claim every job. Failing at cold start is louder.
function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set on this function`);
  }
  return value;
}

// The router reports every job result through this client. Sharing it from here lets the route check
// swap it for a recorder.
export const codePipelineClient = new CodePipelineClient();

// The functionName filters match against these. CDK injects them on both functions.
export const DEPLOYER_FUNCTION_NAME = requiredEnvironment('DEPLOYER_FUNCTION_NAME');
export const NOTIFIER_FUNCTION_NAME = requiredEnvironment('NOTIFIER_FUNCTION_NAME');
