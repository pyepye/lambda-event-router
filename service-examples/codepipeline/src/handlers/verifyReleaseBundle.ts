import { createHash } from 'node:crypto';

import { isObject, logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/codepipeline';

import { VERIFY_STEP } from '../config.js';
import { DEPLOYER_FUNCTION_NAME } from '../environment.js';
import { withReleaseContext } from '../middleware/withReleaseContext.js';
import { artifactStore } from '../utils/artifactStore.js';
import { VerifyParametersSchema } from '../utils/schemas.js';
import { zipSingleFile } from '../utils/zip.js';

// The only deployer route that wants the source artifact, so hasInputArtifacts picks it out. The
// custom filter reads UserParameters before any schema runs, so it guards with isObject.
// The sha it returns becomes a CodePipeline output variable, which the canary action reads back in
// its own UserParameters.
export const verifyReleaseBundle = defineRoute({
  filters: {
    functionName: DEPLOYER_FUNCTION_NAME,
    hasInputArtifacts: true,
    custom: ({ userParameters }) => isObject(userParameters) && userParameters.step === VERIFY_STEP,
  },
  userParametersSchema: VerifyParametersSchema,
  middleware: [withReleaseContext],
}).handle(async (request) => {
  const [bundle] = request.inputArtifacts;
  const [report] = request.outputArtifacts;

  // CodePipeline fails the action if the action declares an output artifact and nothing uploads it.
  if (!report) {
    throw new Error(`Verify job ${request.jobId} has no output artifact to write`);
  }

  const objectKey = bundle?.location.s3Location.objectKey ?? '';
  const bundleSha = createHash('sha256').update(objectKey).digest('hex').slice(0, 12);

  const verification = JSON.stringify({
    bundleName: request.userParameters.bundleName,
    environment: request.userParameters.environment,
    bundleSha,
  });

  await artifactStore.put(
    request.artifactCredentials,
    report.location.s3Location,
    zipSingleFile('verification.json', verification),
  );

  logger.info({
    message: 'Release bundle verified',
    jobId: request.jobId,
    artifactName: bundle?.name,
    objectKey,
    bundleSha,
    outputArtifactName: report.name,
    outputObjectKey: report.location.s3Location.objectKey,
  });

  return {
    outputVariables: {
      bundleSha,
      artifactCount: String(request.inputArtifacts.length),
    },
  };
});
