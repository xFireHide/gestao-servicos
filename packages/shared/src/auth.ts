import { z } from 'zod';
import { roleSchema } from './roles';

export const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  // No autoatendimento público só se cria PATIENT; demais papéis são criados por ADMIN.
  role: roleSchema.optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

/** Claims carregadas no JWT de acesso. */
export const jwtClaimsSchema = z.object({
  sub: z.string().uuid(),
  email: z.string().email(),
  role: roleSchema,
});
export type JwtClaims = z.infer<typeof jwtClaimsSchema>;
