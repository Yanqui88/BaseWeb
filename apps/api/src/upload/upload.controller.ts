import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { UploadService } from "./upload.service";

/**
 * POST /upload/image
 *
 * Endpoint protegido para subida de imágenes con optimización automática a WebP.
 *
 * TODO (Seguridad): Agregar guardia de autenticación de admin cuando esté listo.
 *   Ejemplo: @UseGuards(AdminAuthGuard)
 *
 * El archivo se recibe en memoria (memoryStorage) para ser procesado por Sharp
 * antes de escribirse a disco, evitando archivos temporales sin optimizar.
 */
@Controller("upload")
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post("image")
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(), // buffer en RAM para que Sharp lo procese
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB máximo por archivo
      },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
          return cb(
            new BadRequestException("Solo se permiten archivos de imagen."),
            false
          );
        }
        cb(null, true);
      },
    })
  )
  async uploadImage(
    @UploadedFile() file?: Express.Multer.File
  ): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException("No se recibió ningún archivo.");
    }

    const url = await this.uploadService.processAndSave(
      file.buffer,
      file.mimetype
    );

    return { url };
  }
}
