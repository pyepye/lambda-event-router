import type { CodePipelineRequest, CodePipelineResponse } from '@lambda-event-router/codepipeline';
import { z } from 'zod';

export const ArtifactParametersSchema = z.object({
  targetBucket: z.string(),
  prefix: z.string(),
});

type ArtifactParameters = z.infer<typeof ArtifactParametersSchema>;

// The router automatically calls putJobSuccessResult on success
// and putJobFailureResult if the handler throws.
// userParameters is parsed from JSON and validated against the schema by the router.
export async function processArtifacts({
  jobId,
  userParameters,
  inputArtifacts,
  outputArtifacts,
  artifactCredentials,
}: CodePipelineRequest<ArtifactParameters>): Promise<CodePipelineResponse> {
  const { accessKeyId, secretAccessKey, sessionToken } = artifactCredentials;
  const { targetBucket, prefix } = userParameters;
  console.log(`Processing job ${jobId} with credentials ${accessKeyId}`);
  console.log(`Target: s3://${targetBucket}/${prefix}`);

  for (const artifact of inputArtifacts) {
    const { name, location } = artifact;
    const { bucketName, objectKey } = location.s3Location;
    console.log(`Input artifact ${name}: s3://${bucketName}/${objectKey}`);
  }

  for (const artifact of outputArtifacts) {
    const { name } = artifact;
    console.log(`Output artifact ${name}`);
  }

  console.log(`Secret: ${secretAccessKey}, Session: ${sessionToken}`);

  return undefined;
}
