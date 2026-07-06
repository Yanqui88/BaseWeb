import { Injectable, BadRequestException } from "@nestjs/common";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";

@Injectable()
export class UploadService {
  /**
   * Recibe el buffer de la imagen en memoria, la procesa con Sharp:
   *   - Escala a máx 1920×1080 preservando el aspect ratio (sin upscaling)
   *   - Convierte a formato WebP con calidad 80
   * Guarda el resultado en `<cwd>/uploads/<uuid>.webp` y retorna la URL pública.
   */
  async processAndSave(buffer: Buffer, mimetype: string): Promise<string> {
    if (!mimetype.startsWith("image/")) {
      throw new BadRequestException("Solo se permiten archivos de imagen.");
    }

    // Convertir y optimizar con Sharp
    const optimized = await sharp(buffer)
      .resize({
        width: 1920,
        height: 1080,
        fit: "inside",        // mantiene aspect ratio, sin distorsión
        withoutEnlargement: true, // no hace upscale si la imagen es más pequeña
      })
      .webp({ quality: 80 })
      .toBuffer();

    // Asegurar que la carpeta uploads/ exista
    const uploadsDir = join(process.cwd(), "uploads");
    await mkdir(uploadsDir, { recursive: true });

    // Nombre de archivo único con UUID
    const filename = `${randomUUID()}.webp`;
    const filePath = join(uploadsDir, filename);

    await writeFile(filePath, optimized);

    return `/uploads/${filename}`;
  }
}
