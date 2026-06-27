import { Prisma } from '@prisma/client';
import { TenantContext } from '../tenant/tenant-context';

/**
 * Modelos cujo acesso é isolado por empresa (tenant). RefreshToken e Organization
 * ficam de fora: o primeiro é resolvido por hash global (pré-auth), a segunda é o
 * próprio tenant (criada no onboarding, antes de existir contexto de org).
 */
const TENANT_MODELS = new Set<Prisma.ModelName>([
  'User',
  'Doctor',
  'Patient',
  'CustomerInteraction',
  'Service',
  'Availability',
  'Appointment',
  'AuditLog',
]);

/**
 * Middleware Prisma que força o isolamento multiempresa: quando há um org no
 * contexto da request, toda leitura/escrita dos modelos de tenant é restrita a
 * essa empresa. Sem contexto de org (seed, jobs, rotas públicas) nada é injetado.
 *
 * Limitação do Prisma: `findUnique`/`update`/`delete` só aceitam campos únicos no
 * `where`. Convertemos as leituras únicas para `findFirst` (retorno idêntico) e
 * injetamos o org; escritas por id já vêm precedidas de uma leitura org-guarded.
 */
export function createTenantMiddleware(tenant: TenantContext): Prisma.Middleware {
  return async (params, next) => {
    const organizationId = tenant.getOrganizationId();

    if (!organizationId || !params.model || !TENANT_MODELS.has(params.model)) {
      return next(params);
    }

    switch (params.action) {
      case 'findUnique':
      case 'findUniqueOrThrow': {
        params.action = params.action === 'findUnique' ? 'findFirst' : 'findFirstOrThrow';
        params.args = params.args ?? {};
        params.args.where = { ...params.args.where, organizationId };
        break;
      }
      case 'findFirst':
      case 'findFirstOrThrow':
      case 'findMany':
      case 'count':
      case 'aggregate':
      case 'groupBy':
      case 'updateMany':
      case 'deleteMany': {
        params.args = params.args ?? {};
        params.args.where = { ...params.args.where, organizationId };
        break;
      }
      case 'create': {
        params.args = params.args ?? {};
        params.args.data = { organizationId, ...params.args.data };
        break;
      }
      case 'createMany': {
        params.args = params.args ?? {};
        const data = params.args.data;
        params.args.data = Array.isArray(data)
          ? data.map((row: Record<string, unknown>) => ({ organizationId, ...row }))
          : { organizationId, ...data };
        break;
      }
      // update/delete/upsert: por id único, já autorizados por leitura prévia.
      default:
        break;
    }

    return next(params);
  };
}
