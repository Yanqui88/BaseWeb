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
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, LoginResponse, ProfileResponse } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Obtiene la información del usuario autenticado y su tenant.
   *
   * @route GET /auth/me
   * @headers Authorization: Bearer <access_token>
   * @returns ProfileResponse
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: Request): Promise<ProfileResponse> {
    const userPayload = (req as any)['user'] as { sub?: string; id?: string; tenantId?: string };
    const tenantId = userPayload?.tenantId ?? '';
    const userId = userPayload?.sub ?? userPayload?.id ?? '';
    return this.authService.getMe(tenantId, userId);
  }

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


