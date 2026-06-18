import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from 'node:crypto';
import type { Env } from '../../config/env';

/**
 * Criptografia a nível de campo para PII sensível em repouso (LGPD).
 * AES-256-GCM autenticado. Formato armazenado: base64(iv|authTag|ciphertext).
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService<Env, true>) {
    const raw = config.get('FIELD_ENCRYPTION_KEY', { infer: true });
    // Aceita chave base64 (32 bytes) ou deriva 32 bytes de uma string arbitrária.
    const decoded = Buffer.from(raw, 'base64');
    this.key = decoded.length === 32 ? decoded : createHash('sha256').update(raw).digest();
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  decrypt(payload: string): string {
    const buf = Buffer.from(payload, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  }

  /** Hash determinístico (HMAC) para lookup de valores únicos sem expor o plaintext. */
  blindIndex(value: string): string {
    return createHmac('sha256', this.key).update(value).digest('hex');
  }
}
