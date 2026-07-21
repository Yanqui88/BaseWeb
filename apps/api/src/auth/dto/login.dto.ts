/**
 * @file login.dto.ts
 * @description DTO de entrada para el endpoint POST /auth/login.
 */

import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'El campo "email" debe ser un correo electrónico válido.' })
  @IsNotEmpty({ message: 'El campo "email" es requerido.' })
  email!: string;

  @IsString({ message: 'El campo "password" debe ser un texto.' })
  @IsNotEmpty({ message: 'El campo "password" es requerido.' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres.' })
  password!: string;
}
