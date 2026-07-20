#!/usr/bin/env bash
# =============================================================================
# backup.sh — PostgreSQL → S3-compatible (Cloudflare R2 / AWS S3 / MinIO)
# =============================================================================
# Uso:
#   ./apps/api/scripts/backup.sh
#
# Variables de entorno requeridas (configurar en .env o en el entorno del sistema):
#   DATABASE_URL          → postgresql://user:pass@host:5432/dbname
#   BACKUP_S3_BUCKET      → nombre del bucket (ej. "mi-saas-backups")
#   BACKUP_S3_ENDPOINT    → endpoint S3-compatible (vacío para AWS S3 oficial)
#                           Cloudflare R2: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
#                           MinIO:         http://localhost:9000
#   BACKUP_S3_REGION      → región (ej. "auto" para R2, "us-east-1" para AWS)
#   AWS_ACCESS_KEY_ID     → Access Key ID del proveedor S3-compatible
#   AWS_SECRET_ACCESS_KEY → Secret Access Key del proveedor S3-compatible
#
# Opcional:
#   BACKUP_RETENTION_DAYS → número de días de retención de backups (default: 30)
#   BACKUP_PREFIX         → prefijo de ruta en el bucket (default: "db-backups")
#
# Dependencias del sistema:
#   - pg_dump (PostgreSQL client tools)
#   - gzip
#   - aws CLI (v2) configurada con el proveedor correcto
#
# Salida:
#   Sube el archivo <PREFIX>/YYYY-MM-DD_HH-MM-SS.sql.gz al bucket S3.
# =============================================================================

set -euo pipefail

# ── Cargar .env si existe (para ejecución manual) ────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/apps/api/.env"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "${ENV_FILE}"
  set +a
fi

# ── Validar variables de entorno ─────────────────────────────────────────────
: "${DATABASE_URL:?La variable DATABASE_URL es requerida}"
: "${BACKUP_S3_BUCKET:?La variable BACKUP_S3_BUCKET es requerida}"
: "${AWS_ACCESS_KEY_ID:?La variable AWS_ACCESS_KEY_ID es requerida}"
: "${AWS_SECRET_ACCESS_KEY:?La variable AWS_SECRET_ACCESS_KEY es requerida}"

BACKUP_PREFIX="${BACKUP_PREFIX:-db-backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
BACKUP_S3_REGION="${BACKUP_S3_REGION:-auto}"

# ── Construir nombre del archivo de backup ────────────────────────────────────
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILENAME="${TIMESTAMP}.sql.gz"
BACKUP_S3_KEY="${BACKUP_PREFIX}/${BACKUP_FILENAME}"
TMP_DUMP_FILE="/tmp/pgdump_${TIMESTAMP}.sql.gz"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🗄️  ProyectoWeb — Backup PostgreSQL → S3"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🕐 Timestamp  : ${TIMESTAMP}"
echo "🪣 Bucket     : ${BACKUP_S3_BUCKET}"
echo "📂 S3 Key     : ${BACKUP_S3_KEY}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Paso 1: pg_dump + gzip ───────────────────────────────────────────────────
echo "📤 [1/3] Ejecutando pg_dump y comprimiendo..."

pg_dump \
  --format=plain \
  --no-owner \
  --no-acl \
  --compress=0 \
  "${DATABASE_URL}" \
  | gzip -9 > "${TMP_DUMP_FILE}"

DUMP_SIZE=$(du -sh "${TMP_DUMP_FILE}" | cut -f1)
echo "✅ Dump completado: ${TMP_DUMP_FILE} (${DUMP_SIZE})"

# ── Paso 2: Subir a S3 ───────────────────────────────────────────────────────
echo "☁️  [2/3] Subiendo al bucket S3..."

AWS_ARGS=(
  s3 cp "${TMP_DUMP_FILE}" "s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_KEY}"
  --region "${BACKUP_S3_REGION}"
  --storage-class STANDARD
)

# Si se especificó un endpoint custom (R2, MinIO, etc.)
if [[ -n "${BACKUP_S3_ENDPOINT:-}" ]]; then
  AWS_ARGS+=(--endpoint-url "${BACKUP_S3_ENDPOINT}")
fi

aws "${AWS_ARGS[@]}"
echo "✅ Backup subido exitosamente: s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_KEY}"

# ── Paso 3: Eliminar archivo temporal ────────────────────────────────────────
echo "🧹 [3/3] Limpiando archivo temporal..."
rm -f "${TMP_DUMP_FILE}"
echo "✅ Archivo temporal eliminado."

# ── Paso 4 (Opcional): Eliminar backups antiguos del bucket ──────────────────
# Solo se ejecuta si BACKUP_RETENTION_DAYS > 0 y la CLI soporta listado.
if [[ "${BACKUP_RETENTION_DAYS}" -gt 0 ]]; then
  echo ""
  echo "🗑️  Eliminando backups anteriores a ${BACKUP_RETENTION_DAYS} días..."

  CUTOFF_DATE=$(date -d "-${BACKUP_RETENTION_DAYS} days" +%Y-%m-%d 2>/dev/null || \
                date -v-"${BACKUP_RETENTION_DAYS}"d +%Y-%m-%d 2>/dev/null || \
                echo "")

  if [[ -n "${CUTOFF_DATE}" ]]; then
    LIST_ARGS=(
      s3 ls "s3://${BACKUP_S3_BUCKET}/${BACKUP_PREFIX}/"
      --region "${BACKUP_S3_REGION}"
    )
    if [[ -n "${BACKUP_S3_ENDPOINT:-}" ]]; then
      LIST_ARGS+=(--endpoint-url "${BACKUP_S3_ENDPOINT}")
    fi

    aws "${LIST_ARGS[@]}" | while read -r line; do
      FILE_DATE=$(echo "${line}" | awk '{print $1}')
      FILE_NAME=$(echo "${line}" | awk '{print $4}')

      if [[ -n "${FILE_NAME}" ]] && [[ "${FILE_DATE}" < "${CUTOFF_DATE}" ]]; then
        DEL_ARGS=(
          s3 rm "s3://${BACKUP_S3_BUCKET}/${BACKUP_PREFIX}/${FILE_NAME}"
          --region "${BACKUP_S3_REGION}"
        )
        if [[ -n "${BACKUP_S3_ENDPOINT:-}" ]]; then
          DEL_ARGS+=(--endpoint-url "${BACKUP_S3_ENDPOINT}")
        fi

        aws "${DEL_ARGS[@]}" && echo "  ✂️  Eliminado: ${FILE_NAME}"
      fi
    done
  else
    echo "⚠️  No se pudo determinar la fecha de corte. Omitiendo limpieza."
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Backup completado exitosamente."
echo "   Archivo: s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_KEY}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
