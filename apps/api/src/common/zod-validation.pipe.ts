import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';

/**
 * Valida o payload contra um schema Zod de @clinica/shared.
 * Mantém os DTOs como fonte única de verdade compartilhada com o frontend.
 */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    try {
      return this.schema.parse(value);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException({
          message: 'Validação falhou',
          issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        });
      }
      throw err;
    }
  }
}
