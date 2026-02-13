import { HTTPRouter } from '@lambda-event-router/http';
import type { ALBEvent, ALBResult } from 'aws-lambda';
import { albAdapter } from './albAdapter.js';

export class ALBRouter extends HTTPRouter<ALBEvent, ALBResult> {
  constructor() {
    super(albAdapter);
  }
}

export function createALBRouter(): ALBRouter {
  return new ALBRouter();
}
