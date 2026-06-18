import { Body, Controller, Get, Post, UsePipes } from '@nestjs/common';
import {
  AuthTokens,
  JwtClaims,
  LoginInput,
  loginSchema,
  RefreshInput,
  refreshSchema,
  RegisterInput,
  registerSchema,
} from '@clinica/shared';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CurrentUser, Public } from '../../common/decorators';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @UsePipes(new ZodValidationPipe(registerSchema))
  register(@Body() body: RegisterInput): Promise<AuthTokens> {
    return this.auth.register(body);
  }

  @Public()
  @Post('login')
  @UsePipes(new ZodValidationPipe(loginSchema))
  login(@Body() body: LoginInput): Promise<AuthTokens> {
    return this.auth.login(body);
  }

  @Public()
  @Post('refresh')
  @UsePipes(new ZodValidationPipe(refreshSchema))
  refresh(@Body() body: RefreshInput): Promise<AuthTokens> {
    return this.auth.refresh(body.refreshToken);
  }

  /** Claims do usuário autenticado — útil para o frontend hidratar a sessão. */
  @Get('me')
  me(@CurrentUser() user: JwtClaims): JwtClaims {
    return user;
  }
}
