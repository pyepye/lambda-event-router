// The Invoke AWS Lambda function blocks set these parameters. `step` is what tells the routes apart,
// because every contact in this example arrives on the same channel and initiation method.
export const STEP_PARAMETER = 'step';
export const PRIORITY_PARAMETER = 'priority';
export const ORDER_REF_PARAMETER = 'orderRef';
export const FAILED_STEP_PARAMETER = 'failedStep';

export const HIGH_PRIORITY = 'high';

export const GREET_STEP = 'greetCustomer';
export const LOOKUP_ORDER_STEP = 'lookupOrder';
export const DELIVERY_SLOT_STEP = 'checkDeliverySlot';
export const CALLBACK_OFFER_STEP = 'offerCallback';
export const AGENT_HANDOVER_STEP = 'handOverToAgent';
export const FLOW_ERROR_STEP = 'recordFlowError';
export const TRIAGE_STEP = 'triageEnquiry';
export const REFUND_STEP = 'requestRefund';

// Contact attributes. The trigger sets ORDER_REF_ATTRIBUTE when it starts the chat, and the flow
// stores a handler response under each of the others.
export const ORDER_REF_ATTRIBUTE = 'orderRef';
export const FLOW_COMPLETE_ATTRIBUTE = 'flowComplete';

export const ORDER_REF = 'AB-1029';
export const DELIVERY_SLOT = 'thursday-0900-1300';
