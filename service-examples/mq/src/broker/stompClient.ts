import { connect as tlsConnect } from 'node:tls';

export interface StompMessage {
  destination: string;
  body: Buffer;
  headers?: Record<string, string>;
  // ActiveMQ reads content-length alone to pick the JMS message type. Present makes a BytesMessage,
  // absent makes a TextMessage, and that is the only way a client chooses between them.
  binary?: boolean;
}

interface StompFrame {
  command: string;
  headers: Record<string, string>;
  body: string;
}

const NUL = Buffer.from([0]);
const EMPTY = Buffer.alloc(0);

function escapeHeaderValue(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('\r', '\\r').replaceAll('\n', '\\n').replaceAll(':', '\\c');
}

function buildFrame(command: string, headers: Record<string, string>, body: Buffer): Buffer {
  const lines = [command, ...Object.entries(headers).map(([name, value]) => `${name}:${escapeHeaderValue(value)}`)];
  return Buffer.concat([Buffer.from(`${lines.join('\n')}\n\n`, 'utf-8'), body, NUL]);
}

function parseFrame(raw: string): StompFrame {
  const separator = raw.indexOf('\n\n');
  const head = separator === -1 ? raw : raw.slice(0, separator);
  const body = separator === -1 ? '' : raw.slice(separator + 2);
  const [command = '', ...headerLines] = head.split('\n');

  const headers: Record<string, string> = {};
  for (const line of headerLines) {
    const colon = line.indexOf(':');
    if (colon > 0) headers[line.slice(0, colon)] = line.slice(colon + 1);
  }

  return { command, headers, body };
}

// STOMP is a text protocol over TLS: a command line, headers, a blank line, the body, then a NUL.
// Publishing needs CONNECT, one SEND per message and DISCONNECT, and every SEND asks for a receipt so
// the broker has taken the message before the next one goes out.
export async function publishToActiveMq(
  endpoint: string,
  login: string,
  passcode: string,
  messages: StompMessage[],
): Promise<void> {
  const { hostname, port } = new URL(endpoint);

  const failed = Promise.withResolvers<never>();
  failed.promise.catch(() => {});
  const settle = <T>(promise: Promise<T>): Promise<T> => Promise.race([promise, failed.promise]);

  const ready = Promise.withResolvers<void>();
  const connected = Promise.withResolvers<void>();
  const receipts = new Map<string, PromiseWithResolvers<void>>();

  const socket = tlsConnect({ host: hostname, port: Number(port), servername: hostname });
  socket.setEncoding('utf-8');
  socket.on('error', (error) => failed.reject(error));
  socket.on('secureConnect', () => ready.resolve());

  let pending = '';
  socket.on('data', (chunk: string) => {
    pending += chunk;
    let end = pending.indexOf('\0');
    while (end !== -1) {
      const raw = pending.slice(0, end).replace(/^[\r\n]+/, '');
      pending = pending.slice(end + 1);
      if (raw.length > 0) {
        const frame = parseFrame(raw);
        if (frame.command === 'ERROR') {
          failed.reject(new Error(`Broker rejected the frame: ${frame.headers.message ?? frame.body}`));
        } else if (frame.command === 'CONNECTED') {
          connected.resolve();
        } else if (frame.command === 'RECEIPT') {
          receipts.get(frame.headers['receipt-id'] ?? '')?.resolve();
        }
      }
      end = pending.indexOf('\0');
    }
  });

  try {
    await settle(ready.promise);
    const connectHeaders = { 'accept-version': '1.2', host: hostname, login, passcode, 'heart-beat': '0,0' };
    socket.write(buildFrame('CONNECT', connectHeaders, EMPTY));
    await settle(connected.promise);

    for (const [index, message] of messages.entries()) {
      const receiptId = `send-${index}`;
      const headers: Record<string, string> = {
        destination: `/queue/${message.destination}`,
        receipt: receiptId,
        ...message.headers,
      };
      if (message.binary) headers['content-length'] = String(message.body.length);

      const receipt = Promise.withResolvers<void>();
      receipts.set(receiptId, receipt);
      socket.write(buildFrame('SEND', headers, message.body));
      await settle(receipt.promise);
    }

    const goodbye = Promise.withResolvers<void>();
    receipts.set('bye', goodbye);
    socket.write(buildFrame('DISCONNECT', { receipt: 'bye' }, EMPTY));
    await settle(goodbye.promise);
  } finally {
    socket.destroy();
  }
}
