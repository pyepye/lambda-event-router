import type { Artifact, CodePipelineEvent, Context } from 'aws-lambda';

const DEPLOYER = 'ler-example-codepipeline-deployer';
const NOTIFIER = 'ler-example-codepipeline-notifier';

// environment.ts reads the function names once, at import, and throws when either is missing. The
// logger builds itself on the first call. Both have to be settled before the router loads.
process.env.AWS_LAMBDA_LOG_FORMAT = 'JSON';
process.env.DEPLOYER_FUNCTION_NAME = DEPLOYER;
process.env.NOTIFIER_FUNCTION_NAME = NOTIFIER;

const { FIRST_CANARY_TOKEN, SECOND_CANARY_TOKEN } = await import('../src/config.js');
const { codePipelineClient } = await import('../src/environment.js');
const { artifactStore } = await import('../src/utils/artifactStore.js');
const { codePipelineRouter } = await import('../src/codepipeline.js');

const ACCOUNT = '123456789012';
const REGION = 'eu-west-2';
const BUNDLE_SHA = '9f2c1ab4de77';

const context = {
  functionName: DEPLOYER,
  awsRequestId: 'check-routes',
  invokedFunctionArn: `arn:aws:lambda:${REGION}:${ACCOUNT}:function:${DEPLOYER}`,
  getRemainingTimeInMillis: () => 10_000,
} as unknown as Context;

interface JobResult {
  command: string;
  input: Record<string, unknown>;
}

const jobResults: JobResult[] = [];

// Every route ends in PutJobSuccessResult or PutJobFailureResult. Record the call instead of making it.
codePipelineClient.send = (async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
  jobResults.push({ command: command.constructor.name, input: command.input });
  return {};
}) as unknown as typeof codePipelineClient.send;

const uploads: string[] = [];

// The verify route writes its output artifact. Record the upload instead of making it.
artifactStore.put = async (_credentials, location, body) => {
  uploads.push(`${location.bucketName}/${location.objectKey} ${body.length} bytes`);
};

const releaseBundle: Artifact = {
  name: 'ReleaseBundle',
  revision: null,
  location: { type: 'S3', s3Location: { bucketName: 'release-bucket', objectKey: 'release/ReleaseBundle.zip' } },
};

const verificationReport: Artifact = {
  name: 'VerificationReport',
  revision: null,
  location: { type: 'S3', s3Location: { bucketName: 'release-bucket', objectKey: 'release/VerificationReport.zip' } },
};

interface JobOptions {
  functionName: string;
  userParameters: Record<string, unknown> | string;
  inputArtifacts?: Artifact[];
  outputArtifacts?: Artifact[];
  continuationToken?: string;
}

let jobCount = 0;

function createJob(options: JobOptions): CodePipelineEvent {
  jobCount += 1;
  return {
    'CodePipeline.job': {
      id: `job-${jobCount}`,
      accountId: ACCOUNT,
      data: {
        actionConfiguration: {
          configuration: {
            FunctionName: options.functionName,
            UserParameters:
              typeof options.userParameters === 'string'
                ? options.userParameters
                : JSON.stringify(options.userParameters),
          },
        },
        inputArtifacts: options.inputArtifacts ?? [],
        outputArtifacts: options.outputArtifacts ?? [],
        artifactCredentials: {
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          sessionToken: 'FwoGZXIvYXdzEBYaDEXAMPLETOKEN',
        },
        continuationToken: options.continuationToken,
      },
    },
  };
}

interface Job {
  name: string;
  event: CodePipelineEvent;
  expected: {
    logIncludes?: string[];
    reports?: { command: string; includes: string[] };
    uploads?: string[];
    errorIncludes?: string;
  };
}

const canaryParameters = { step: 'canary', environment: 'staging', bundleSha: BUNDLE_SHA };

const jobs: Job[] = [
  {
    name: 'a notifier job reaches publishReleaseNotes with its UserParameters unparsed',
    event: createJob({ functionName: NOTIFIER, userParameters: 'releases' }),
    expected: {
      logIncludes: ['Handling CodePipeline job', 'Release notes published', '"userParameters":"releases"'],
      reports: { command: 'PutJobSuccessResultCommand', includes: ['job-1'] },
    },
  },
  {
    name: 'a deployer job with an artifact reaches verifyReleaseBundle and writes its output',
    event: createJob({
      functionName: DEPLOYER,
      userParameters: { step: 'verify', environment: 'staging', bundleName: 'checkout-service' },
      inputArtifacts: [releaseBundle],
      outputArtifacts: [verificationReport],
    }),
    expected: {
      logIncludes: ['Release context resolved', 'Release bundle verified', '"outputArtifactName":"VerificationReport"'],
      reports: { command: 'PutJobSuccessResultCommand', includes: ['bundleSha', '"artifactCount":"1"'] },
      uploads: ['release-bucket/release/VerificationReport.zip'],
    },
  },
  {
    name: 'a canary job with no token reaches startCanaryDeployment',
    event: createJob({ functionName: DEPLOYER, userParameters: canaryParameters }),
    expected: {
      logIncludes: ['Canary deployment started', `"bundleSha":"${BUNDLE_SHA}"`],
      reports: { command: 'PutJobSuccessResultCommand', includes: [`"continuationToken":"${FIRST_CANARY_TOKEN}"`] },
    },
  },
  {
    name: 'a canary job with the first token reaches awaitCanaryHealth',
    event: createJob({
      functionName: DEPLOYER,
      userParameters: canaryParameters,
      continuationToken: FIRST_CANARY_TOKEN,
    }),
    expected: {
      logIncludes: ['Canary still warming up'],
      reports: { command: 'PutJobSuccessResultCommand', includes: [`"continuationToken":"${SECOND_CANARY_TOKEN}"`] },
    },
  },
  {
    name: 'a canary job with the second token finishes the action',
    event: createJob({
      functionName: DEPLOYER,
      userParameters: canaryParameters,
      continuationToken: SECOND_CANARY_TOKEN,
    }),
    expected: {
      logIncludes: ['Canary healthy'],
      reports: { command: 'PutJobSuccessResultCommand', includes: ['job-5'] },
    },
  },
  {
    name: 'a deployer job with no artifact reaches rollbackRelease, which throws',
    event: createJob({ functionName: DEPLOYER, userParameters: { step: 'rollback', environment: 'staging' } }),
    expected: {
      errorIncludes: 'Rollback target unavailable for job job-6',
      reports: { command: 'PutJobFailureResultCommand', includes: ['Rollback target unavailable'] },
    },
  },
  {
    name: 'a deployer job with an unclaimed step matches no route',
    event: createJob({
      functionName: DEPLOYER,
      userParameters: { step: 'reconcile', environment: 'staging' },
      inputArtifacts: [releaseBundle],
    }),
    expected: {
      errorIncludes: 'No route matched for CodePipeline job job-7',
      reports: { command: 'PutJobFailureResultCommand', includes: ['No route matched'] },
    },
  },
  {
    name: 'a verify job with no environment fails its schema',
    event: createJob({
      functionName: DEPLOYER,
      userParameters: { step: 'verify', bundleName: 'checkout-service' },
      inputArtifacts: [releaseBundle],
    }),
    expected: {
      errorIncludes: 'UserParameters validation failed for job job-8',
      reports: { command: 'PutJobFailureResultCommand', includes: ['UserParameters validation failed'] },
    },
  },
];

// Handlers report by logging, and the router reports by the command it sends. Both are captured.
async function runCapturingLogs(event: CodePipelineEvent): Promise<{ logged: string; error?: unknown }> {
  uploads.length = 0;
  const lines: string[] = [];
  const collect = (...args: unknown[]): void => {
    lines.push(JSON.stringify(args));
  };

  const { log, debug, warn, error } = console;
  Object.assign(console, { log: collect, debug: collect, warn: collect, error: collect });

  try {
    await codePipelineRouter.handleEvent(event, context);
    return { logged: lines.join('\n') };
  } catch (thrown) {
    return { logged: lines.join('\n'), error: thrown };
  } finally {
    Object.assign(console, { log, debug, warn, error });
  }
}

function problemsWith(logged: string, error: unknown, reported: JobResult[], expected: Job['expected']): string[] {
  const problems: string[] = [];
  const sent = reported.map((result) => `${result.command} ${JSON.stringify(result.input)}`).join('\n');
  const written = uploads.join('\n');

  if (expected.errorIncludes) {
    const message = error instanceof Error ? error.message : String(error);
    if (error === undefined) {
      problems.push(`did not throw, logged ${logged.slice(0, 200)}`);
    } else if (!message.includes(expected.errorIncludes)) {
      problems.push(`threw ${message}`);
    }
  } else if (error !== undefined) {
    problems.push(`threw ${error instanceof Error ? error.message : String(error)}`);
  }

  problems.push(
    ...(expected.logIncludes ?? [])
      .filter((fragment) => !logged.includes(fragment))
      .map((fragment) => `logged nothing containing ${fragment}`),
  );

  problems.push(
    ...(expected.uploads ?? [])
      .filter((fragment) => !written.includes(fragment))
      .map((fragment) => `uploaded ${written || 'nothing'} rather than ${fragment}`),
  );

  if (expected.reports) {
    if (!reported.some((result) => result.command === expected.reports?.command)) {
      problems.push(`sent ${sent || 'nothing'} rather than ${expected.reports.command}`);
    }
    problems.push(
      ...expected.reports.includes
        .filter((fragment) => !sent.includes(fragment))
        .map((fragment) => `sent nothing containing ${fragment}`),
    );
  }

  return problems;
}

const failures: string[] = [];

function report(label: string, problems: string[]): void {
  if (problems.length === 0) {
    console.log(`ok   ${label}`);
    return;
  }
  failures.push(label);
  console.log(`FAIL ${label}: ${problems.join(', ')}`);
}

for (const job of jobs) {
  jobResults.length = 0;
  const { logged, error } = await runCapturingLogs(job.event);
  report(job.name, problemsWith(logged, error, [...jobResults], job.expected));
}

const validJob = createJob({ functionName: DEPLOYER, userParameters: { step: 'rollback' } });

const claims: [string, boolean][] = [
  ['the router takes a CodePipeline job event', codePipelineRouter.canHandleEvent(validJob)],
  ['the router turns an SQS event away', !codePipelineRouter.canHandleEvent({ Records: [{ eventSource: 'aws:sqs' }] })],
  ['the router turns a bare string away', !codePipelineRouter.canHandleEvent('CodePipeline.job')],
  ['the router turns a job with no data away', !codePipelineRouter.canHandleEvent({ 'CodePipeline.job': { id: 'x' } })],
];

for (const [label, held] of claims) {
  report(label, held ? [] : ['did not hold']);
}

console.log(
  failures.length === 0 ? '\nEvery job landed where it was meant to.' : `\n${failures.length} check(s) failed.`,
);

if (failures.length > 0) process.exitCode = 1;
