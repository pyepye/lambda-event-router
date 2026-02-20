import { defineRoute } from '@lambda-event-router/codepipeline';
import { z } from 'zod';

import { FUNCTION_NAME } from '../constants.js';

const UserParametersSchema = z.object({
  targetBucket: z.string(),
  prefix: z.string(),
});

// The router automatically calls putJobSuccessResult on success
// and putJobFailureResult if the handler throws.
// userParameters is parsed from JSON and validated against the schema by the router.
export const processArtifactsRoute = defineRoute({
  filters: {
    functionNames: [FUNCTION_NAME],
    hasInputArtifacts: true,
  },
  userParametersSchema: UserParametersSchema,
}).handle(async ({ jobId, userParameters, inputArtifacts, artifactCredentials }) => {
  const { accessKeyId, secretAccessKey, sessionToken } = artifactCredentials;
  const { targetBucket, prefix } = userParameters;
  console.log(`Processing job ${jobId} with credentials ${accessKeyId}`);
  console.log(`Target: s3://${targetBucket}/${prefix}`);

  for (const artifact of inputArtifacts) {
    const { name, location } = artifact;
    const { bucketName, objectKey } = location.s3Location;
    console.log(`Artifact ${name}: s3://${bucketName}/${objectKey}`);
  }

  console.log(`Secret: ${secretAccessKey}, Session: ${sessionToken}`);
});
