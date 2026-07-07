/**
 * @file auth.controller.ts
 * @description Controlador HTTP del módulo de autenticación.
 *
 * Expone el endpoint `POST /auth/login` para que los administradores
 * de tenant inicien sesión con email y contraseña.
 */

import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { AuthService, LoginResponse } from './auth.service.js';

/** DTO de entrada para el endpoint de login. */
interface LoginDto {
  email: string;
  password: string;
}

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

    // Validación manual explícita de campos requeridos.
    if (!email || typeof email !== 'string' || email.trim() === '') {
      throw new BadRequestException('El campo "email" es requerido.');
    }
    if (!password || typeof password !== 'string' || password.trim() === '') {
      throw new BadRequestException('El campo "password" es requerido.');
    }

    return this.authService.login(email.trim(), password);
  }
}
