/**
 * @file register-tenant.dto.ts
 * @description DTO para el endpoint público POST /saas/register.
 *
 * Valida los campos requeridos para crear un nuevo tenant (tienda) de forma
 * self-service. Se usan decoradores de class-validator para validación automática.
 */

import { IsEmail, IsString, MinLength, Matches, MaxLength } from 'class-validator';

export class RegisterTenantDto {
  /**
   * Nombre visible de la tienda.
   * Se usará como `name` en la tabla `tenants` y para generar el `slug`.
   */
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  storeName: string;

  /**
   * Dominio o subdominio personalizado para la tienda.
   * Debe ser un hostname válido (ej. "mitienda.com" o "mitienda").
   * Se verifica unicidad antes del INSERT.
   */
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  @Matches(/^[a-z0-9]([a-z0-9\-\.]*[a-z0-9])?$/, {
    message:
      'El dominio solo puede contener letras minúsculas, números, guiones y puntos.',
  })
  domain: string;

  /**
   * Email del administrador de la tienda.
   * Se usará como login y se verifica unicidad dentro del tenant creado.
   */
  @IsEmail()
  @MaxLength(255)
  email: string;

  /**
   * Contraseña del administrador en texto plano.
   * Se hasheará con bcrypt (rounds: 12) antes de persistir.
   */
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
