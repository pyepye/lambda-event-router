import { type ConfirmChannel, connect } from 'amqplib';

// Opens one confirmed channel, hands it to the caller and waits for the broker to acknowledge every
// publish before closing. Without the confirmation a close can drop a message still in flight.
export async function withRabbitMqChannel<T>(
  endpoint: string,
  username: string,
  password: string,
  work: (channel: ConfirmChannel) => Promise<T>,
): Promise<T> {
  const { hostname, port } = new URL(endpoint);
  const url = `amqps://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${hostname}:${port}`;

  const connection = await connect(url);
  try {
    const channel = await connection.createConfirmChannel();
    const result = await work(channel);
    await channel.waitForConfirms();
    await channel.close();
    return result;
  } finally {
    await connection.close();
  }
}
