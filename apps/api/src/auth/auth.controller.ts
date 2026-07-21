/**
 * @file auth.controller.ts
 * @description Controlador HTTP del módulo de autenticación.
 *
 * Expone el endpoint `POST /auth/login` para que los administradores
 * de tenant inicien sesión con email y contraseña.
 */

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { AuthService, LoginResponse } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Autentica a un administrador de tenant.
   *
   * @route POST /auth/login
   * @body  { email: string, password: string }
   * @returns { access_token, refresh_token, tenant_id }
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto): Promise<LoginResponse> {
    const { email, password } = body;
    return this.authService.login(email.trim(), password);
  }
}

