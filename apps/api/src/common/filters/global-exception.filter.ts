/**
 * @file global-exception.filter.ts
 * @description Filtro global de excepciones para NestJS.
 *
 * Captura todas las excepciones no controladas y respuestas de error HTTP.
 * Garantiza que en producción NUNCA se expongan stack traces, códigos de error
 * internos de PostgreSQL (ej: 23505, 42P01) o detalles sensibles de la infraestructura.
 */

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'object' ? res : { message: res };
    } else if (exception instanceof Error) {
      // Loguear el error completo con stack trace en la consola/servidor para depuración
      this.logger.error(
        `[${request.method} ${request.url}] Unhandled exception: ${exception.message}`,
        exception.stack,
      );

      // En producción o ambiente seguro, nunca enviamos el stack trace o detalles de DB al cliente
      const isProduction = process.env.NODE_ENV === 'production';
      message = {
        statusCode: status,
        message: isProduction
          ? 'An internal server error occurred.'
          : exception.message,
        error: 'Internal Server Error',
      };
    } else {
      this.logger.error(
        `[${request.method} ${request.url}] Unknown exception caught`,
        String(exception),
      );
      message = {
        statusCode: status,
        message: 'An internal server error occurred.',
        error: 'Internal Server Error',
      };
    }

    response.status(status).json(
      typeof message === 'object' && message !== null
        ? { timestamp: new Date().toISOString(), path: request.url, ...message }
        : {
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message,
          },
    );
  }
}
