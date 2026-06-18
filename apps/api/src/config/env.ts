import { z } from 'zod';

/** Validação do ambiente na inicialização — falha cedo se algo estiver faltando. */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3001),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.coerce.number().int().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().default(604800),
  FIELD_ENCRYPTION_KEY: z.string().min(16),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().default(1025),
  MAIL_FROM: z.string().default('no-reply@clinica.local'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`Configuração de ambiente inválida:\n${parsed.error.toString()}`);
  }
  return parsed.data;
}
