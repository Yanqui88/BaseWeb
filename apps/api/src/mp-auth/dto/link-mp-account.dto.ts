/**
 * @file link-mp-account.dto.ts
 * @description DTO para vincular una cuenta de Mercado Pago vía OAuth.
 */

import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class LinkMpAccountDto {
  @IsString({ message: 'El campo "code" debe ser texto.' })
  @IsNotEmpty({ message: 'El campo "code" es requerido.' })
  code!: string;

  @IsString({ message: 'El campo "redirectUri" debe ser texto.' })
  @IsNotEmpty({ message: 'El campo "redirectUri" es requerido.' })
  @IsUrl({ require_tld: false }, { message: 'El campo "redirectUri" debe ser una URL válida.' })
  redirectUri!: string;
}
