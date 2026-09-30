# Seguridad

## Controles presentes

Argon2id (64 MiB, 3 iteraciones), contraseñas de 12–128 caracteres; sesiones de 12 horas por defecto; cookies HttpOnly, Strict y Secure en producción; tokens de sesión, recuperación y correo almacenados como hashes; MFA cifrado AES-256-GCM con clave del entorno; TOTP de un solo uso y códigos de recuperación consumidos atómicamente.

Origen validado en mutaciones, CSRF para solicitudes autenticadas, Helmet, DTOs Zod estrictos, consultas parametrizadas. Límites persistentes por IP y cuenta, bloqueo exponencial desde cinco fallos. Cambio/restablecimiento de contraseña revoca sesiones.

Tenant y permisos se comprueban en servidor. Roles base no son modificables. Nadie puede otorgar permisos fuera de los propios; cambios propios de membresía requieren otro propietario. No se permite dejar sin propietario a una organización.

Auditoría registra acciones administrativas y de autenticación sin contraseñas, secretos TOTP, códigos ni tokens. Los eventos de autenticación son globales y no aparecen en el visor de organización. Logs de errores omiten cuerpos y parámetros sensibles.

## Controles adicionales verificados

La API local usa `alia_runtime`, miembro de `alia_app`, sin privilegios de superusuario, DDL, creación de DB ni administración de roles. Las migraciones conceden permisos explícitos; audit_logs permite únicamente SELECT/INSERT. En producción la API rechaza una cuenta con privilegios elevados. Compose separa credenciales de migración y aplicación, y no pasa el archivo .env completo a la API.

La cola mail_outbox se escribe junto con invitación/restablecimiento y auditoría en la misma transacción. El contenido se cifra con AES-256-GCM usando la clave MFA; desaparece después de envío, cancelación o seis fallos. Vencimiento y revocación se verifican antes de enviar. SMTP exige TLS en producción. Entrega at-least-once: una caída entre aceptación SMTP y commit puede repetir el mismo mensaje; Message-ID estable facilita deduplicación, sin garantizarla.

Respaldo local cifrado con otra clave y restauración completa comprobados. Las pruebas se ejecutan automáticamente en una base temporal dedicada.

## Antes de producción

- Mantener credenciales de migración fuera del proceso de API. El provisionador necesita administración de roles de PostgreSQL; servicios administrados pueden requerir adaptar el aprovisionamiento a su política.
- Terminar TLS, configurar SMTP real y dominio APP_ORIGIN. Rotación y custodia externa de claves. No rotar la clave MFA sin migrar los secretos cifrados.
- Definir proxy confiable explícito para límites por IP; actualmente no se confía en cabeceras X-Forwarded-For. Detrás de Nginx el límite de IP se comparte; los límites por cuenta siguen aplicando.
- Auditoría externa inmutable, retención y monitoreo operativo según política del establecimiento.
- Pacientes ya incorpora RLS forzada, autorización API y filtro tenant. Extender políticas y pruebas a tablas clínicas antes de incorporarlas. Las tablas administrativas previas mantienen aislamiento API/FK.
- Resolver protección y recuperación de cuenta cuando se pierden simultáneamente TOTP y códigos. No existe un bypass administrativo de MFA.
- Programar alertas sobre mail_outbox en estado failed. Para reenviar, revocar la invitación y crear una nueva; los enlaces vencidos nunca se reactivan.
- Prueba independiente de seguridad y accesibilidad; ejecutar Docker en un host compatible; ensayar periódicamente la restauración en la infraestructura de destino.

No se afirma que el software garantice cumplimiento normativo ni que esta base esté habilitada para recibir expedientes reales. Las normas clínicas y plantillas versionadas corresponden a fase 3.
