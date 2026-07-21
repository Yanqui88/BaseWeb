/**
 * @file mp-auth.controller.ts
 * @description Controlador HTTP para el módulo de OAuth de Mercado Pago.
 *
 * Expone el endpoint `POST /mp-auth/link` que recibe el código de autorización
 * OAuth devuelto por Mercado Pago y lo intercambia por tokens de acceso.
 *
 * **Seguridad:**
 * - Protegido por `JwtAdminGuard`: solo administradores de tenant autenticados
 *   pueden llamar a este endpoint.
 * - El `tenantId` se obtiene desde el payload del JWT (ya validado por el guard),
 *   nunca desde el body de la request (evita manipulación de cliente).
 *
 * **Flujo:**
 * 1. El frontend redirige al administrador a la URL de autorización de MP.
 * 2. MP redirige de vuelta al frontend con un `code` en los query params.
 * 3. El frontend envía ese `code` + el `redirectUri` original a este endpoint.
 * 4. Este endpoint llama a `MpAuthService.linkAccount()` para intercambiar el código.
 */

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAdminGuard } from './mp-auth.guard.js';
import { MpAuthService } from './mp-auth.service.js';
import { LinkMpAccountDto } from './dto/link-mp-account.dto.js';

/** Forma mínima de la Request con el tenantId inyectado por el Guard. */
interface AuthenticatedRequest {
  tenantId: string;
}

@Controller('mp-auth')
export class MpAuthController {
  constructor(private readonly mpAuthService: MpAuthService) {}

  /**
   * Vincula la cuenta de Mercado Pago del tenant autenticado.
   *
   * @route  POST /mp-auth/link
   * @guard  JwtAdminGuard (requiere Bearer token válido)
   * @body   { code: string, redirectUri: string }
   * @returns Confirmación del enlace exitoso con el mp_user_id.
   */
  @Post('link')
  @UseGuards(JwtAdminGuard)
  @HttpCode(HttpStatus.OK)
  async linkAccount(
    @Req() req: AuthenticatedRequest,
    @Body() body: LinkMpAccountDto,
  ): Promise<{ success: boolean; mp_user_id: number }> {
    const { code, redirectUri } = body;

    const result = await this.mpAuthService.linkAccount(
      req.tenantId,
      code.trim(),
      redirectUri.trim(),
    );

    return result;
  }
}

