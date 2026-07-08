import {
  AGENT_HANDOVER_STEP,
  CALLBACK_OFFER_STEP,
  DELIVERY_SLOT_STEP,
  FAILED_STEP_PARAMETER,
  FLOW_COMPLETE_ATTRIBUTE,
  FLOW_ERROR_STEP,
  GREET_STEP,
  HIGH_PRIORITY,
  LOOKUP_ORDER_STEP,
  ORDER_REF_ATTRIBUTE,
  ORDER_REF_PARAMETER,
  PRIORITY_PARAMETER,
  REFUND_STEP,
  STEP_PARAMETER,
  TRIAGE_STEP,
} from '../src/utils/constants.js';

const FLOW_VERSION = '2019-10-30';
const INVOCATION_TIME_LIMIT_SECONDS = '8';
const ANY_ERROR = 'NoMatchingError';

interface Transitions {
  NextAction: string;
  Errors?: { NextAction: string; ErrorType: string }[];
}

interface Action {
  Identifier: string;
  Type: string;
  Parameters: Record<string, unknown>;
  Transitions: Transitions | Record<string, never>;
}

function transitions(next: string, onError: string): Transitions {
  return { NextAction: next, Errors: [{ NextAction: onError, ErrorType: ANY_ERROR }] };
}

function invoke(
  id: string,
  workerArn: string,
  parameters: Record<string, string>,
  next: string,
  onError: string,
): Action {
  return {
    Identifier: id,
    Type: 'InvokeLambdaFunction',
    Parameters: {
      LambdaFunctionARN: workerArn,
      InvocationTimeLimitSeconds: INVOCATION_TIME_LIMIT_SECONDS,
      LambdaInvocationAttributes: parameters,
      ResponseValidation: { ResponseType: 'STRING_MAP' },
    },
    Transitions: transitions(next, onError),
  };
}

function store(id: string, attributes: Record<string, string>, next: string, onError: string): Action {
  return {
    Identifier: id,
    Type: 'UpdateContactAttributes',
    Parameters: { Attributes: attributes },
    Transitions: transitions(next, onError),
  };
}

// An unexpected error on any block lands on mark-complete, so the trigger stops polling and reports
// the attributes that are missing rather than timing out.
const RECOVER = 'mark-complete';

// A task contact needs a flow of its own. Every block of the chat flow below filters on a step that
// only a chat reaches, so a task sent through it would match nothing after the first block.
export function taskFlowContent(workerArn: string): string {
  const actions: Action[] = [
    invoke('triage-invoke', workerArn, { [STEP_PARAMETER]: TRIAGE_STEP }, 'triage-store', RECOVER),
    store('triage-store', { triageStatus: '$.External.triageStatus' }, 'task-unrouted-invoke', RECOVER),

    // No route claims a refund step on any channel, so this one names TASK in the router's error.
    invoke('task-unrouted-invoke', workerArn, { [STEP_PARAMETER]: REFUND_STEP }, RECOVER, RECOVER),

    store(RECOVER, { [FLOW_COMPLETE_ATTRIBUTE]: 'true' }, 'disconnect', 'disconnect'),
    { Identifier: 'disconnect', Type: 'DisconnectParticipant', Parameters: {}, Transitions: {} },
  ];

  return JSON.stringify({ Version: FLOW_VERSION, StartAction: 'triage-invoke', Actions: actions });
}

// The chat runs one Invoke AWS Lambda function block per route the deployed run proves, storing each
// response as a contact attribute. Two blocks fail on purpose and take their Error branch.
export function contactFlowContent(workerArn: string): string {
  const actions: Action[] = [
    invoke('greet-invoke', workerArn, { [STEP_PARAMETER]: GREET_STEP }, 'greet-store', RECOVER),
    store('greet-store', { greetingStatus: '$.External.greetingStatus' }, 'lookup-invoke', RECOVER),

    invoke(
      'lookup-invoke',
      workerArn,
      { [STEP_PARAMETER]: LOOKUP_ORDER_STEP, [ORDER_REF_PARAMETER]: `$.Attributes.${ORDER_REF_ATTRIBUTE}` },
      'lookup-store',
      RECOVER,
    ),
    store('lookup-store', { orderStatus: '$.External.orderStatus' }, 'slot-invoke', RECOVER),

    invoke('slot-invoke', workerArn, { [STEP_PARAMETER]: DELIVERY_SLOT_STEP }, 'slot-store', RECOVER),
    store('slot-store', { deliverySlot: '$.External.deliverySlot' }, 'callback-invoke', RECOVER),

    invoke('callback-invoke', workerArn, { [STEP_PARAMETER]: CALLBACK_OFFER_STEP }, 'callback-store', RECOVER),
    store('callback-store', { callbackOffered: '$.External.callbackOffered' }, 'escalation-invoke', RECOVER),

    // The same step as lookup-invoke, with priority high. escalateToSupervisor is registered first,
    // so it takes this one and lookupOrder never sees it.
    invoke(
      'escalation-invoke',
      workerArn,
      {
        [STEP_PARAMETER]: LOOKUP_ORDER_STEP,
        [PRIORITY_PARAMETER]: HIGH_PRIORITY,
        [ORDER_REF_PARAMETER]: `$.Attributes.${ORDER_REF_ATTRIBUTE}`,
      },
      'escalation-store',
      RECOVER,
    ),
    store('escalation-store', { escalationTicket: '$.External.escalationTicket' }, 'handover-invoke', RECOVER),

    // failAgentHandover throws, so the Error branch is the path the flow actually takes.
    invoke(
      'handover-invoke',
      workerArn,
      { [STEP_PARAMETER]: AGENT_HANDOVER_STEP },
      'refund-invoke',
      'handover-error-invoke',
    ),
    invoke(
      'handover-error-invoke',
      workerArn,
      { [STEP_PARAMETER]: FLOW_ERROR_STEP, [FAILED_STEP_PARAMETER]: AGENT_HANDOVER_STEP },
      'handover-error-store',
      RECOVER,
    ),
    store('handover-error-store', { handoverError: '$.External.failedStep' }, 'refund-invoke', RECOVER),

    // No route matches this step, so the router throws and the Error branch is the path again.
    invoke('refund-invoke', workerArn, { [STEP_PARAMETER]: REFUND_STEP }, RECOVER, 'unrouted-error-invoke'),
    invoke(
      'unrouted-error-invoke',
      workerArn,
      { [STEP_PARAMETER]: FLOW_ERROR_STEP, [FAILED_STEP_PARAMETER]: REFUND_STEP },
      'unrouted-error-store',
      RECOVER,
    ),
    store('unrouted-error-store', { unroutedError: '$.External.failedStep' }, RECOVER, RECOVER),

    store(RECOVER, { [FLOW_COMPLETE_ATTRIBUTE]: 'true' }, 'disconnect', 'disconnect'),
    { Identifier: 'disconnect', Type: 'DisconnectParticipant', Parameters: {}, Transitions: {} },
  ];

  return JSON.stringify({
    Version: FLOW_VERSION,
    StartAction: 'greet-invoke',
    Actions: actions,
  });
}
