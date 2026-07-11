// Values the pipeline and the worker both need. The CDK stack and the release script import this
// file, so nothing here may read the worker's environment.

// Step names are fixed strings rather than CDK-generated ones, so the route filters and the
// pipeline's UserParameters share one source.
export const VERIFY_STEP = 'verify';
export const CANARY_STEP = 'canary';
export const ROLLBACK_STEP = 'rollback';
export const RECONCILE_STEP = 'reconcile';

// The canary route hands the first token back to CodePipeline and reads it again on the next
// invocation. The second token ends the loop.
export const FIRST_CANARY_TOKEN = 'canary-1';
export const SECOND_CANARY_TOKEN = 'canary-2';

// The release script starts the pipeline by this name, so it needs no deploy output for it.
export const PIPELINE_NAME = 'ler-example-codepipeline-release';
export const RELEASE_BUNDLE_KEY = 'release.zip';
