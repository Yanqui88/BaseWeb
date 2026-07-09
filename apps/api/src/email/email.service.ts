/**
 * @file email.service.ts
 * @description Servicio de envío de correos transaccionales usando la API REST de Resend.
 *
 * No depende de ningún SDK: usa fetch nativo de Node 18+ para evitar dependencias extra.
 *
 * **Variables de entorno requeridas:**
 * - `RESEND_API_KEY`: API key de Resend.
 * - `RESEND_FROM_EMAIL`: Dirección remitente (ej: "notificaciones@tudominio.com").
 *
 * Si estas variables no están configuradas, el servicio loguea una advertencia
 * y retorna sin error para no bloquear el flujo principal de negocio.
 */

import { Injectable, Logger } from '@nestjs/common';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly RESEND_API_URL = 'https://api.resend.com/emails';

  /**
   * Envía un correo electrónico usando la API REST de Resend.
   * No lanza excepciones: registra el error en el logger y retorna silenciosamente
   * para no bloquear los flujos críticos de la aplicación (ej: confirmación de pago).
   */
  async send(options: SendEmailOptions): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'no-reply@example.com';

    if (!apiKey) {
      this.logger.warn(
        `[EmailService] RESEND_API_KEY no está configurada. ` +
          `Email a "${Array.isArray(options.to) ? options.to.join(', ') : options.to}" no enviado.`,
      );
      return;
    }

    try {
      const body = JSON.stringify({
        from: fromEmail,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
      });

      const response = await fetch(this.RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
        this.logger.error(
          `[EmailService] Error al enviar email. Status: ${response.status}. ` +
            `Detalle: ${JSON.stringify(errorData)}`,
        );
        return;
      }

      this.logger.log(
        `[EmailService] Email enviado exitosamente a: ` +
          `${Array.isArray(options.to) ? options.to.join(', ') : options.to}`,
      );
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(
        `[EmailService] Excepción al enviar email: ${error.message}`,
        error.stack,
      );
    }
  }
}
