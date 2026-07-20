---
name: db-backup-s3
version: "1.0.0"
description: >
  Habilidad para ejecutar backups automatizados de PostgreSQL comprimidos (.sql.gz)
  y subirlos a un bucket S3-compatible (Cloudflare R2, AWS S3, MinIO).
  Incluye política de retención configurable por días.
triggers:
  - cron: "0 3 * * *"   # Todos los días a las 03:00 UTC (recomendado)
  - manual: true
dependencies:
  system:
    - pg_dump             # PostgreSQL client tools (>= v14)
    - gzip
    - aws-cli             # AWS CLI v2 (configurado para el proveedor S3 target)
  env_vars:
    required:
      - DATABASE_URL
      - BACKUP_S3_BUCKET
      - AWS_ACCESS_KEY_ID
      - AWS_SECRET_ACCESS_KEY
    optional:
      - BACKUP_S3_ENDPOINT    # Para R2/MinIO. Omitir para AWS S3 nativo.
      - BACKUP_S3_REGION      # Default: "auto" (R2) / "us-east-1" (AWS)
      - BACKUP_RETENTION_DAYS # Default: 30
      - BACKUP_PREFIX         # Default: "db-backups"
script: apps/api/scripts/backup.sh
---

# Skill: db-backup-s3

## Propósito

Esta habilidad permite a cualquier subagente o sistema de automatización (cron, CI/CD,
script de despliegue) ejecutar un backup completo de la base de datos PostgreSQL del
proyecto **ProyectoWeb**, subirlo comprimido a un bucket S3-compatible y eliminar
automáticamente los backups más antiguos que el período de retención configurado.

## Cuándo invocar esta habilidad

| Escenario | Acción |
|-----------|--------|
| **Mantenimiento rutinario** | Cron job diario a las 03:00 UTC |
| **Antes de migraciones destructivas** | Invocar manualmente antes de `migrate:up` |
| **Antes de un despliegue mayor** | Parte del pipeline de CI/CD (pre-deploy step) |
| **Ante incidentes de seguridad** | Snapshot de emergencia del estado actual |
| **Cambios de esquema multi-tenant** | Siempre antes de modificar políticas RLS |

## Arquitectura del flujo

```
PostgreSQL (pg_dump)
      │
      ▼  (pipe, sin archivo intermedio SQL en disco)
    gzip -9
      │
      ▼
/tmp/pgdump_<TIMESTAMP>.sql.gz
      │
      ▼
aws s3 cp → s3://<BUCKET>/db-backups/YYYY-MM-DD_HH-MM-SS.sql.gz
      │
      ▼
Limpieza: rm /tmp/pgdump_<TIMESTAMP>.sql.gz
      │
      ▼
Retención: elimina objetos S3 con antigüedad > BACKUP_RETENTION_DAYS
```

## Configuración de variables de entorno

### Para Cloudflare R2

```bash
BACKUP_S3_ENDPOINT="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
BACKUP_S3_REGION="auto"
BACKUP_S3_BUCKET="proyectoweb-backups"
AWS_ACCESS_KEY_ID="<R2_ACCESS_KEY>"
AWS_SECRET_ACCESS_KEY="<R2_SECRET_KEY>"
BACKUP_RETENTION_DAYS=30
```

### Para AWS S3 nativo

```bash
# BACKUP_S3_ENDPOINT no se define (se usa el endpoint oficial de AWS)
BACKUP_S3_REGION="us-east-1"
BACKUP_S3_BUCKET="proyectoweb-backups"
AWS_ACCESS_KEY_ID="<IAM_ACCESS_KEY>"
AWS_SECRET_ACCESS_KEY="<IAM_SECRET_KEY>"
BACKUP_RETENTION_DAYS=30
```

### Para MinIO (desarrollo local)

```bash
BACKUP_S3_ENDPOINT="http://localhost:9000"
BACKUP_S3_REGION="us-east-1"
BACKUP_S3_BUCKET="local-backups"
AWS_ACCESS_KEY_ID="minioadmin"
AWS_SECRET_ACCESS_KEY="minioadmin"
BACKUP_RETENTION_DAYS=7
```

## Instalación del Cron Job (servidor Linux)

Para programar el backup automático diario a las 03:00 UTC en el servidor de producción:

```bash
# Hacer el script ejecutable (solo primera vez)
chmod +x /ruta/al/proyecto/apps/api/scripts/backup.sh

# Editar crontab del usuario del sistema (ej. "deploy" o "ubuntu")
crontab -e

# Agregar esta línea al crontab:
# Backup diario a las 03:00 UTC, con logs rotativos
0 3 * * * /ruta/al/proyecto/apps/api/scripts/backup.sh >> /var/log/saas-backup.log 2>&1
```

## Instalación mediante Docker Compose (alternativa)

Si la API corre en Docker, agregar un servicio de backup al `docker-compose.yml`:

```yaml
services:
  backup:
    image: postgres:16-alpine
    entrypoint: ["/bin/sh", "-c"]
    command:
      - |
        apk add --no-cache aws-cli gzip
        while true; do
          /app/scripts/backup.sh
          sleep 86400  # 24 horas
        done
    environment:
      DATABASE_URL: ${DATABASE_URL}
      BACKUP_S3_BUCKET: ${BACKUP_S3_BUCKET}
      BACKUP_S3_ENDPOINT: ${BACKUP_S3_ENDPOINT}
      BACKUP_S3_REGION: ${BACKUP_S3_REGION}
      AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
      AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
    volumes:
      - ./apps/api/scripts:/app/scripts:ro
```

## Verificación de un backup

Para restaurar un backup y verificar su integridad:

```bash
# Descargar el último backup
aws s3 cp \
  s3://<BUCKET>/db-backups/<BACKUP_FILE>.sql.gz \
  /tmp/restore.sql.gz \
  --endpoint-url <ENDPOINT>

# Descomprimir y restaurar en una DB de prueba
gunzip -c /tmp/restore.sql.gz | \
  psql postgresql://user:pass@localhost:5432/proyectoweb_restore

# Verificar datos
psql postgresql://user:pass@localhost:5432/proyectoweb_restore \
  -c "SELECT COUNT(*) FROM tenants;"
```

## Variables adicionales requeridas en `.env`

Agregar al archivo `apps/api/.env` y `.env.production.example`:

```bash
# ── Backup S3 ──────────────────────────────────────────────────────────────
BACKUP_S3_BUCKET="proyectoweb-backups"
BACKUP_S3_ENDPOINT="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
BACKUP_S3_REGION="auto"
BACKUP_RETENTION_DAYS="30"
BACKUP_PREFIX="db-backups"
# AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY se configuran como secrets del sistema
```

## Notas de seguridad

- El script utiliza `set -euo pipefail` para abortar ante cualquier error.
- El archivo `.sql.gz` temporal se elimina siempre, incluso ante errores (usar trap en producción crítica).
- Las credenciales AWS nunca se loggean; el script solo imprime nombres de archivos y timestamps.
- El bucket S3 debe tener **block public access** habilitado.
- Usar IAM policies con **permisos mínimos**: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:ListBucket`.
