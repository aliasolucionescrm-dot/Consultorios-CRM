# Despliegue y operación

## Docker

Configurar `.env` con POSTGRES_PASSWORD (hexadecimal para la URL), APP_DB_PASSWORD (64 caracteres hexadecimales), APP_ORIGIN HTTPS, MFA_ENCRYPTION_KEY, SMTP y secretos propios. `docker compose up --build -d` construye la aplicación, espera PostgreSQL, aplica migraciones, provisiona `alia_runtime` y arranca API, web y Nginx. Solo el trabajo de migraciones recibe credenciales administrativas. Nginx publica únicamente `127.0.0.1:8080` para un terminador TLS externo. Nunca publicar API/DB directamente. Los contenedores de aplicación usan usuario no root.

Compose y Dockerfile están preparados pero **no ejecutados en el equipo de desarrollo**, donde Docker no está instalado. Antes de producción deben comprobarse en un host compatible. La separación de permisos ya se probó en PostgreSQL local. Las imágenes están fijadas por versión mayor; fijar digest verificado en el pipeline de despliegue.

Redis opcional: `docker compose --profile queues up -d redis`; no está involucrado en la fase 1. Los archivos privados usan un volumen persistente cifrado; no se publican desde Nginx.

## Salud

`GET /health/live` confirma proceso. `GET /health/ready` consulta la tabla de migraciones. No incluyen configuración ni secretos. Swagger solo está disponible fuera de producción.

## Backups

Respaldar PostgreSQL con `pg_dump -Fc` usando credenciales fuera de argumentos públicos; guardar cifrado fuera del host. Política inicial propuesta: diarios 30 días, semanales 12 semanas; ajustar a obligaciones y necesidades del establecimiento. Añadir archivado WAL/PITR para el RPO acordado.

Restaurar regularmente con `pg_restore` en otra base vacía y aislada. Comparar migraciones, conteos y relaciones; ejecutar smoke tests de acceso, organizaciones y auditoría. Registrar fecha, duración y resultado. **Restauración local verificada el 28 de septiembre de 2026:** 16 tablas, conteos y huellas de contenido iguales al snapshot de origen, permisos de auditoría preservados. Esto no verifica copias remotas ni recuperación del host completo. El respaldo actual debe incluir también el volumen privado y sus claves de recuperación.

### Ensayo automatizado local

`npm run db:backup-drill` requiere MIGRATION_DATABASE_URL y DATABASE_URL locales, PG_BIN apuntando a pg_dump/pg_restore 17 y BACKUP_ENCRYPTION_KEY (32 bytes en hex). Exporta un snapshot PostgreSQL en transacción read-only, genera archivo custom, cifra AES-256-GCM y restaura **desde el archivo cifrado** en una DB de nombre aleatorio creada por el script. Compara contenido y permisos; elimina solo esa DB y el archivo temporal sin cifrar. Conserva archivo `.dump.aes` y evidencia `.json` en `.local/backups`. Es un ensayo para bases locales pequeñas, no un sistema de backups masivos. La clave de cifrado y la clave MFA deben custodiarse fuera del host para recuperación real.

Herramientas oficiales consultadas: [pg_dump 17](https://www.postgresql.org/docs/17/app-pgdump.html), [pg_restore 17](https://www.postgresql.org/docs/17/app-pgrestore.html) y [binarios EDB](https://www.enterprisedb.com/download-postgresql-binaries). No se instaló un servicio PostgreSQL global.

### Primera cuenta sin datos ficticios

Ejecutar `npm run db:bootstrap` en el entorno de migraciones con BOOTSTRAP_EMAIL, BOOTSTRAP_NAME y BOOTSTRAP_PASSWORD. Solo permite una instalación sin usuarios. La cuenta crea su organización desde la interfaz y debe activar MFA. Quitar estas variables después del uso; no usar el seed en producción.

## Entorno Windows entregado

La base local se conserva en `.local/postgres`. El buzón en memoria se reinicia al parar su proceso. Los procesos de desarrollo pueden iniciarse desde las terminales indicadas en README. Mantener una instalación convencional Node/npm para operación continua. No usar seeds de demostración en producción.

## Instalación en Ubuntu Server

Requiere Git, Docker Engine y el complemento Docker Compose. Con Docker disponible:

```bash
git clone https://github.com/aliasolucionescrm-dot/Consultorios-CRM.git
cd Consultorios-CRM
cp .env.production.example .env
chmod 600 .env
# Generar cuatro secretos distintos y colocarlos en .env:
openssl rand -hex 32
# Editar también APP_ORIGIN (dominio HTTPS) y el servidor SMTP real.
nano .env
docker compose config --quiet
docker compose up --build -d
docker compose ps -a
docker compose logs --tail=100 migrate api web nginx
curl --fail http://127.0.0.1:8080/health/ready
```

Configurar el proxy HTTPS del servidor para enviar el dominio a `127.0.0.1:8080`. Su límite de carga debe permitir 14 MiB. El dominio debe coincidir exactamente con APP_ORIGIN. El puerto 8080 solo escucha localmente; no es la dirección pública de acceso.

Crear la primera cuenta desde Bash, sin escribir la contraseña en el historial:

```bash
read -r -p 'Correo: ' BOOTSTRAP_EMAIL
read -r -p 'Nombre: ' BOOTSTRAP_NAME
read -r -s -p 'Contraseña (mínimo 16 caracteres): ' BOOTSTRAP_PASSWORD
printf '\n'
export BOOTSTRAP_EMAIL BOOTSTRAP_NAME BOOTSTRAP_PASSWORD
docker compose run --rm -e BOOTSTRAP_EMAIL -e BOOTSTRAP_NAME -e BOOTSTRAP_PASSWORD migrate npm run db:bootstrap
unset BOOTSTRAP_EMAIL BOOTSTRAP_NAME BOOTSTRAP_PASSWORD
```

Iniciar sesión, crear la organización y activar MFA. Esta operación no funciona si ya existen usuarios.

### Archivos y actualizaciones

El volumen `private-files` conserva fotos, documentos y evidencias cifradas; `postgres-data` conserva la base. Respaldar ambos y custodiar por separado `.env`, especialmente PRIVATE_STORAGE_KEY y MFA_ENCRYPTION_KEY. Perder o cambiar la clave de archivos impide leer los documentos existentes. No ejecutar `docker compose down -v` para actualizar: elimina los volúmenes.

Antes de actualizar, realizar un respaldo consistente de base y archivos. Después ejecutar `git pull --ff-only` y `docker compose up --build -d`, revisar migraciones y salud. El primer despliegue crea una instalación vacía: Git no transfiere pacientes, contraseñas ni archivos de la instalación local. Una migración de esos datos requiere una transferencia privada de base, archivos y claves correspondientes.

Los ajustes Docker de almacenamiento y cargas se revisaron estáticamente; sigue pendiente ejecutar el despliegue completo en un equipo con Docker.

