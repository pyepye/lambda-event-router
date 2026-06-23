// Shared between the CDK stack, the worker and the scripts, so the queue names, secret names and
// ports only exist once.

export const ORDER_QUEUES = {
  events: 'order-events',
  invalid: 'order-events-invalid',
} as const;

// A RabbitMQ event source mapping gets one execution environment, so one failing message holds its
// queue until it expires. Each kind of failure needs a queue of its own to be reported at all.
export const PAYMENT_QUEUES = {
  events: 'payment-events',
  invalid: 'payment-events-invalid',
  reviews: 'payment-reviews',
  receipts: 'payment-receipts',
} as const;

export const SECRET_NAMES = {
  orderBroker: 'ler-example-mq/order-broker',
  paymentBroker: 'ler-example-mq/payment-broker',
} as const;

export const BROKER_USERNAME = 'ler-example';

// Amazon MQ takes an alphanumeric password of at least 12 characters, with no comma, colon or
// equals sign.
export const BROKER_PASSWORD_LENGTH = 32;

// The two ActiveMQ ports the security group opens. Lambda polls over OpenWire, and the publish script
// uses STOMP because it is the one ActiveMQ protocol that lets a client choose the JMS message type.
export const BROKER_PORTS = {
  openWire: 61617,
  stomp: 61614,
} as const;
