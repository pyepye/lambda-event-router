import { buildDecrypt } from '@aws-crypto/decrypt-node';
import { KmsKeyringNode } from '@aws-crypto/kms-keyring-node';
import { CommitmentPolicy } from '@aws-crypto/material-management-node';
import { logger } from '@lambda-event-router/base';
import type { CustomEmailSenderRequest } from '@lambda-event-router/cognito';
import type { CustomEmailSenderTriggerEvent } from 'aws-lambda';

import { CUSTOM_SENDER_KEY_ARN } from '../config.js';

const { decrypt } = buildDecrypt(CommitmentPolicy.FORBID_ENCRYPT_ALLOW_DECRYPT);
const keyring = new KmsKeyringNode({ keyIds: [CUSTOM_SENDER_KEY_ARN] });

// request.code is an AWS Encryption SDK message in base64, not a raw KMS ciphertext, so kms:Decrypt
// on its own will not read it.
async function readCode(code: string): Promise<string> {
  const { plaintext } = await decrypt(keyring, Buffer.from(code, 'base64'));
  return plaintext.toString('utf8');
}

// Cognito sends no mail at all once a pool has this trigger, so delivering the code is the handler's
// job. Logging it stands in for the mail provider a real system would call.
export async function deliverStaffCode({
  event,
  triggerSource,
}: CustomEmailSenderRequest): Promise<CustomEmailSenderTriggerEvent> {
  const code = event.request.code ? await readCode(event.request.code) : undefined;

  logger.info({ message: 'Staff code decrypted', userName: event.userName, triggerSource, code });

  return event;
}
