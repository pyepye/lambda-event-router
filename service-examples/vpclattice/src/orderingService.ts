import { logger } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';
import { latticeRequest, type RequestResult } from './ordering/latticeRequest.js';
import { buildSteps, type Expected, type PayloadVersion, type Step } from './ordering/steps.js';
import { V1_LISTENER_PORT, V2_LISTENER_PORT } from './utils/constants.js';

export interface Report {
  lines: string[];
  failures: string[];
}

const LISTENER_PORTS: Record<PayloadVersion, number> = {
  '1.0': V1_LISTENER_PORT,
  '2.0': V2_LISTENER_PORT,
};

function problemsWith(received: RequestResult, expected: Expected): string[] {
  const problems: string[] = [];
  const { status, body } = received;

  if (status !== expected.status) problems.push(`status ${status} (${body.slice(0, 120)})`);
  if (expected.bodyIncludes && !body.includes(expected.bodyIncludes)) problems.push(`body ${body.slice(0, 200)}`);
  if (expected.bodyIs !== undefined && body !== expected.bodyIs) problems.push(`body ${JSON.stringify(body)}`);

  for (const [name, value] of Object.entries(expected.headers ?? {})) {
    const actual = received.headers[name];
    if (value === null && actual !== undefined) problems.push(`${name} is ${actual}`);
    if (value !== null && actual !== value) problems.push(`${name} is ${String(actual)}`);
  }

  return problems;
}

async function runStep(step: Step, version: PayloadVersion, report: Report): Promise<void> {
  const label = `${version} ${step.name}`;

  try {
    const received = await latticeRequest({ ...step.request, port: LISTENER_PORTS[version] });
    const problems = problemsWith(received, step.expected);

    if (problems.length === 0) {
      report.lines.push(`ok   ${label}`);
      return;
    }
    report.failures.push(label);
    report.lines.push(`FAIL ${label}: ${problems.join(', ')}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report.failures.push(label);
    report.lines.push(`FAIL ${label}: ${message}`);
  }
}

// Invoked with no payload. Every route runs against the 1.0 listener and then the 2.0 one, so the
// inventory log reads as two passes over the same request list.
export const handler: Handler<unknown, Report> = async () => {
  const report: Report = { lines: [], failures: [] };

  for (const version of ['1.0', '2.0'] as const) {
    for (const step of buildSteps(version)) {
      await runStep(step, version, report);
    }
  }

  logger.info({
    message: 'Inventory calls finished',
    requests: report.lines.length,
    failures: report.failures.length,
  });

  return report;
};
