/**
 * @file crypto.util.ts
 * @description Utilidades de encriptación/desencriptación simétricas usando AES-256-GCM.
 *
 * Diseñado para cifrar tokens sensibles (access_token, refresh_token de Mercado Pago)
 * antes de persistirlos en la base de datos.
 *
 * **Formato del texto cifrado:**
 * `<iv_hex>:<authTag_hex>:<encryptedData_hex>`
 *
 * Todos los segmentos están en hexadecimal para permitir almacenamiento seguro en
 * columnas VARCHAR de PostgreSQL sin problemas de encoding.
 *
 * **Variable de entorno requerida:**
 * - `MP_ENCRYPTION_KEY`: Clave de 32 bytes en formato hexadecimal (64 caracteres hex).
 *   Generarla con: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
 */

import * as crypto from 'crypto';

/** Algoritmo de cifrado simétrico autenticado. */
const ALGORITHM = 'aes-256-gcm' as const;

/** Longitud del IV en bytes (96 bits es el estándar recomendado para GCM). */
const IV_LENGTH = 12;

/**
 * Obtiene y valida la clave de encriptación desde las variables de entorno.
 *
 * @throws Error si `MP_ENCRYPTION_KEY` no está definida o tiene longitud inválida.
 * @returns Buffer de 32 bytes con la clave de encriptación.
 */
function getEncryptionKey(): Buffer {
  const hexKey = process.env.MP_ENCRYPTION_KEY;
  if (!hexKey) {
    throw new Error(
      'La variable de entorno MP_ENCRYPTION_KEY no está definida. ' +
        'Generala con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  if (hexKey.length !== 64) {
    throw new Error(
      `MP_ENCRYPTION_KEY debe tener 64 caracteres hexadecimales (32 bytes). ` +
        `Longitud actual: ${hexKey.length}.`,
    );
  }
  return Buffer.from(hexKey, 'hex');
}

/**
 * Encripta un texto plano usando AES-256-GCM.
 *
 * @param text - Texto plano a encriptar (ej: un access_token de Mercado Pago).
 * @returns Cadena en formato `iv:authTag:encryptedData` (todo en hexadecimal).
 *
 * @example
 * const encrypted = encrypt('APP_USR-12345-abcdef...');
 * // => '3f4a1b...:c2d8e9...:7a3f12...'
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encryptedBuffer = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encryptedBuffer.toString('hex'),
  ].join(':');
}

/**
 * Desencripta un texto cifrado con AES-256-GCM.
 *
 * @param encryptedText - Cadena en formato `iv:authTag:encryptedData` (hexadecimal).
 * @returns El texto plano original.
 * @throws Error si el formato es inválido o la autenticación GCM falla (dato corrupto/manipulado).
 *
 * @example
 * const token = decrypt('3f4a1b...:c2d8e9...:7a3f12...');
 * // => 'APP_USR-12345-abcdef...'
 */
export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error(
      'Formato de texto cifrado inválido. Se esperaba: "iv:authTag:encryptedData".',
    );
  }

  const [ivHex, authTagHex, encryptedDataHex] = parts;

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encryptedBuffer = Buffer.from(encryptedDataHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encryptedBuffer),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
